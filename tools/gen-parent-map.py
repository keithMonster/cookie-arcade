#!/usr/bin/env python3
"""从可核验目录生成家长能力地图；--check 仅检查，不写文件。"""
import argparse
import csv
import hashlib
import html
import io
import json
import math
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAFE_ID = re.compile(r"[a-z][a-z0-9_-]*\Z")
TOKENS = ('META', 'RADAR', 'FACETS', 'OPTIONS', 'ROWS')


def required_text(obj, key):
    if not isinstance(obj, dict):
        raise ValueError('目录条目必须是对象')
    value = obj.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{key} 必须是非空字符串')
    return value


def identifier(obj, key):
    value = required_text(obj, key)
    if not SAFE_ID.fullmatch(value):
        raise ValueError(f'{key} 不安全：{value!r}')
    return value


def validate(root, data):
    if not isinstance(data, dict) or type(data.get('schema')) is not int or data.get('schema') != 1:
        raise ValueError('schema 必须为 1')
    reviewed = required_text(data, 'reviewed_on')
    if date.fromisoformat(reviewed).isoformat() != reviewed:
        raise ValueError('reviewed_on 必须为 YYYY-MM-DD')
    domains, facets = {}, {}
    if not isinstance(data.get('domains'), list) or not data['domains']:
        raise ValueError('domains 必须是非空数组')
    for domain in data['domains']:
        domain_id = identifier(domain, 'id')
        required_text(domain, 'name')
        if domain_id in domains:
            raise ValueError('重复 domain id')
        domains[domain_id] = domain
        if not isinstance(domain.get('facets'), list) or not domain['facets']:
            raise ValueError('facets 必须是非空数组')
        for facet in domain['facets']:
            facet_id = identifier(facet, 'id')
            required_text(facet, 'name')
            if facet_id in facets or facet.get('venue') not in ('screen', 'offline'):
                raise ValueError('重复 facet id 或非法 venue')
            facets[facet_id] = (domain_id, facet)
    if not isinstance(data.get('games'), list) or not data['games']:
        raise ValueError('games 必须是非空数组')
    slugs = set()
    for game in data['games']:
        slug = identifier(game, 'slug')
        if slug in slugs:
            raise ValueError('重复 slug')
        slugs.add(slug)
        for key in ('name', 'action', 'limit', 'source'):
            required_text(game, key)
        if game.get('primary') not in domains:
            raise ValueError(f'{slug}: 非法 primary')
        for key in ('core', 'exposure'):
            tags = game.get(key)
            if not isinstance(tags, list) or any(not isinstance(t, str) or t not in facets for t in tags):
                raise ValueError(f'{slug}: 非法 {key} tag')
            if len(tags) != len(set(tags)):
                raise ValueError(f'{slug}: 重复 {key} tag')
        if set(game['core']) & set(game['exposure']):
            raise ValueError(f'{slug}: core 与 exposure 重叠')
        if not any(facets[t][0] == game['primary'] for t in game['core'] + game['exposure']):
            raise ValueError(f'{slug}: primary 无关联标签')
        source = root / 'games' / slug / 'index.html'
        if not source.is_file() or game.get('reviewed_sha') != hashlib.sha256(source.read_bytes()).hexdigest():
            raise ValueError(f'{slug}: 源码缺失或 reviewed_sha 过期')
    disk = {p.name for p in (root / 'games').iterdir() if p.is_dir() and p.name != '_lib'}
    if slugs != disk:
        raise ValueError(f'游戏目录集合不一致：漏={sorted(disk-slugs)} 多={sorted(slugs-disk)}')
    return domains, facets


def coverage(data):
    supported = {tag for game in data['games'] for tag in game['core']}
    return [(sum(f['id'] in supported and f['venue'] == 'screen' for f in d['facets']), len(d['facets'])) for d in data['domains']]


def radar(data):
    counts = coverage(data)
    size, center, radius = 560, 280, 160
    n = len(counts)
    def point(i, scale=1):
        angle = -math.pi / 2 + 2 * math.pi * i / n
        return center + radius * scale * math.cos(angle), center + radius * scale * math.sin(angle)
    def points(scale):
        return ' '.join(f'{x:.2f},{y:.2f}' for x, y in [point(i, scale) for i in range(n)])
    parts = [f'<svg viewBox="0 0 {size} {size}" role="img" aria-label="屏幕游戏明确任务覆盖雷达">']
    for scale in (.25, .5, .75, 1):
        parts.append(f'<polygon points="{points(scale)}" fill="none" stroke="currentColor" opacity=".16"/>')
    values = []
    for i, (domain, (count, total)) in enumerate(zip(data['domains'], counts)):
        x, y = point(i)
        parts.append(f'<line x1="{center}" y1="{center}" x2="{x:.2f}" y2="{y:.2f}" stroke="currentColor" opacity=".2"/>')
        lx, ly = point(i, 1.32)
        parts.append(f'<text x="{lx:.2f}" y="{ly-7:.2f}" text-anchor="middle" font-size="12"><tspan x="{lx:.2f}">{html.escape(domain["name"])}</tspan><tspan x="{lx:.2f}" dy="17">{count}/{total}</tspan></text>')
        vx, vy = point(i, count / total)
        values.append(f'{vx:.2f},{vy:.2f}')
    parts.append(f'<polygon points="{" ".join(values)}" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="2"/></svg>')
    return ''.join(parts)


def render(root, data):
    domains, facets = validate(root, data)
    esc = html.escape
    names = lambda tags: '、'.join(facets[t][1]['name'] for t in tags) or '—'
    rows, facet_sections = [], []
    stream = io.StringIO(newline='')
    writer = csv.writer(stream)
    writer.writerow(['游戏目录', '游戏', '主向', '明确任务', '仅接触', '依据与边界', '源码SHA256'])
    for game in data['games']:
        tags = sorted({facets[t][0] for t in game['core'] + game['exposure']} | {game['primary']})
        core = names(game['core']) + '；' + game['action']
        boundary = game['source'] + '；' + game['limit']
        cells = [f'<a href="../games/{game["slug"]}/">{esc(game["name"])}</a>', esc(domains[game['primary']]['name']), esc(core), esc(names(game['exposure'])), esc(boundary)]
        rows.append(f'<tr data-tags="{esc(",".join(tags))}">' + ''.join(f'<td>{cell}</td>' for cell in cells) + '</tr>')
        writer.writerow([game['slug'], game['name'], domains[game['primary']]['name'], core, names(game['exposure']), boundary, game['reviewed_sha']])
    for domain, (count, total) in zip(data['domains'], coverage(data)):
        items = []
        for facet in domain['facets']:
            core_games = [game['name'] for game in data['games'] if facet['id'] in game['core']]
            exposure_games = [game['name'] for game in data['games'] if facet['id'] in game['exposure']]
            status = '线下主场' if facet['venue'] == 'offline' else ('有明确任务' if core_games else ('仅接触' if exposure_games else '待补'))
            evidence = []
            if core_games:
                evidence.append('明确任务：' + '、'.join(core_games))
            if exposure_games:
                evidence.append('仅接触：' + '、'.join(exposure_games))
            items.append(f'<li>{esc(facet["name"])} <span>{status}</span><small>{esc("；".join(evidence) or "暂无对应游戏")}</small></li>')
        facet_sections.append(f'<section><h3>{esc(domain["name"])} <small>{count}/{total}</small></h3><ul>{"".join(items)}</ul></section>')
    values = {'META': f'复核日期 {esc(data["reviewed_on"])} · {len(data["games"])} 款游戏', 'RADAR': radar(data), 'FACETS': ''.join(facet_sections), 'OPTIONS': ''.join(f'<option value="{esc(d["id"])}">{esc(d["name"])}</option>' for d in data['domains']), 'ROWS': ''.join(rows)}
    template = (root / 'tools' / 'parent-map.html.template').read_text(encoding='utf-8')
    for key in TOKENS:
        if template.count(f'@@{key}@@') != 1:
            raise ValueError(f'模板必须包含一次 @@{key}@@')
    # 单次替换防止数据中的占位符被再次解释。
    output = re.sub(r'@@(META|RADAR|FACETS|OPTIONS|ROWS)@@', lambda m: values[m[1]], template)
    return {'index.html': output.encode('utf-8'), 'games.csv': stream.getvalue().encode('utf-8-sig')}


def generate(root=ROOT, check=False):
    root = Path(root)
    data = json.loads((root / 'parent-map' / 'catalog.json').read_text(encoding='utf-8'))
    outputs = render(root, data)
    stale = []
    for name, content in outputs.items():
        target = root / 'parent-map' / name
        if check:
            if not target.is_file() or target.read_bytes() != content:
                stale.append(name)
        else:
            target.write_bytes(content)
    if stale:
        raise ValueError('生成产物陈旧：' + '、'.join(stale))
    return outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        generate(check=args.check)
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f'✗ 家长地图：{error}', file=sys.stderr)
        return 1
    print('✓ 家长地图数据与产物同步' if args.check else '✓ 已生成家长地图 HTML / CSV')
    return 0


if __name__ == '__main__':
    sys.exit(main())

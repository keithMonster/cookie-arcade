#!/usr/bin/env python3
"""地图生成器的隔离负向测试，不改真实 catalog。"""
import copy
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('parent_map', Path(__file__).with_name('gen-parent-map.py'))
GEN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GEN)


class ParentMapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for folder in ('games/sample', 'games/_lib', 'tools', 'parent-map'):
            (self.root / folder).mkdir(parents=True)
        (self.root / 'games/sample/index.html').write_text('<html>sample</html>')
        (self.root / 'tools/parent-map.html.template').write_text(''.join(f'@@{token}@@' for token in GEN.TOKENS))
        self.data = {'schema': 1, 'reviewed_on': '2026-10-07', 'domains': [{'id': 'spatial', 'name': '空间', 'facets': [{'id': 'shape', 'name': '形状', 'venue': 'screen'}, {'id': 'touch', 'name': '触觉', 'venue': 'offline'}]}], 'games': [{'slug': 'sample', 'name': '示例', 'primary': 'spatial', 'core': ['shape'], 'exposure': ['touch'], 'action': '找形状', 'limit': '不代表掌握', 'source': 'games/sample/index.html', 'reviewed_sha': hashlib.sha256((self.root / 'games/sample/index.html').read_bytes()).hexdigest()}]}

    def reject(self, mutate):
        data = copy.deepcopy(self.data)
        mutate(data)
        with self.assertRaises((ValueError, TypeError)):
            GEN.render(self.root, data)

    def test_missing_directory(self):
        (self.root / 'games/new').mkdir()
        self.reject(lambda data: None)

    def test_duplicate_slug(self):
        self.reject(lambda d: d['games'].append(copy.deepcopy(d['games'][0])))

    def test_invalid_tag(self):
        self.reject(lambda d: d['games'][0]['core'].append('missing'))

    def test_overlap(self):
        self.reject(lambda d: d['games'][0]['exposure'].append('shape'))

    def test_stale_sha(self):
        self.reject(lambda d: d['games'][0].update(reviewed_sha='0' * 64))

    def test_unsafe_slug(self):
        self.reject(lambda d: d['games'][0].update(slug='../sample'))

    def test_duplicate_facet(self):
        self.reject(lambda d: d['domains'][0]['facets'].append(copy.deepcopy(d['domains'][0]['facets'][0])))

    def test_duplicate_domain(self):
        self.reject(lambda d: d['domains'].append(copy.deepcopy(d['domains'][0])))

    def test_invalid_primary(self):
        self.reject(lambda d: d['games'][0].update(primary='missing'))

    def test_blank_field(self):
        self.reject(lambda d: d['games'][0].update(limit=' '))

    def test_escaping_and_offline_coverage(self):
        self.data['games'][0]['name'] = '<script>alert("x")</script>'
        self.data['domains'][0]['name'] = '<img src=x>'
        output = GEN.render(self.root, self.data)
        page = output['index.html'].decode()
        self.assertNotIn('<script>', page)
        self.assertNotIn('<img src=x>', page)
        self.assertIn('&lt;script&gt;', page)
        self.assertEqual(GEN.coverage(self.data), [(1, 2)])
        self.assertTrue(output['games.csv'].startswith(b'\xef\xbb\xbf'))

    def test_stale_outputs_and_read_only_check(self):
        catalog = self.root / 'parent-map/catalog.json'
        catalog.write_text(json.dumps(self.data))
        GEN.generate(self.root)
        GEN.generate(self.root, check=True)
        for name in ('index.html', 'games.csv'):
            target = self.root / 'parent-map' / name
            original = target.read_bytes()
            target.write_bytes(b'stale')
            with self.assertRaisesRegex(ValueError, name.replace('.', r'\.')):
                GEN.generate(self.root, check=True)
            self.assertEqual(target.read_bytes(), b'stale')
            target.write_bytes(original)
        csv_path = self.root / 'parent-map/games.csv'
        csv_path.write_bytes(csv_path.read_bytes()[3:])
        with self.assertRaises(ValueError):
            GEN.generate(self.root, check=True)

    def test_dynamic_domains(self):
        self.data['domains'].append({'id': 'language', 'name': '语言', 'facets': [{'id': 'listen', 'name': '听指令', 'venue': 'screen'}]})
        page = GEN.render(self.root, self.data)['index.html'].decode()
        self.assertIn('语言</tspan>', page)
        self.assertIn('>0/1</tspan>', page)
        self.assertIn('待补', page)

    def test_empty_core_with_exposure(self):
        self.data['games'][0].update(core=[], exposure=['shape'])
        page = GEN.render(self.root, self.data)['index.html'].decode()
        self.assertIn('仅接触：示例', page)
        self.assertEqual(GEN.coverage(self.data), [(0, 2)])
        self.assertIn('线下主场', page)

    def test_primary_in_exposure_with_other_core(self):
        self.data['domains'].append({'id': 'language', 'name': '语言', 'facets': [{'id': 'listen', 'name': '听指令', 'venue': 'screen'}]})
        self.data['games'][0].update(core=['listen'], exposure=['shape'])
        GEN.render(self.root, self.data)

    def test_primary_without_related_tag(self):
        self.reject(lambda d: d['games'][0].update(core=[], exposure=[]))


if __name__ == '__main__':
    unittest.main()

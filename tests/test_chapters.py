import unittest
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


_CHAPTERS_PATH = Path(__file__).parents[1] / "literary_agent" / "chapters.py"
_SPEC = spec_from_file_location("chapters_under_test", _CHAPTERS_PATH)
assert _SPEC and _SPEC.loader
_CHAPTERS = module_from_spec(_SPEC)
_SPEC.loader.exec_module(_CHAPTERS)
split_chapters = _CHAPTERS.split_chapters


class SplitChaptersTests(unittest.TestCase):
    def test_joins_chinese_soft_line_breaks_without_spaces(self) -> None:
        text = "飞船拖曳着尾巴划过船底星\n座的中心地带，开始减速。\n\n他终于踏上了回家\n的路。"

        chapters = split_chapters(text)

        self.assertEqual(
            chapters[0]["paras"],
            ["飞船拖曳着尾巴划过船底星座的中心地带，开始减速。", "他终于踏上了回家的路。"],
        )

    def test_keeps_space_between_english_words(self) -> None:
        chapters = split_chapters("The ship crossed the\nsolar system.")

        self.assertEqual(chapters[0]["paras"], ["The ship crossed the solar system."])

    def test_keeps_one_line_paragraphs_without_blank_lines(self) -> None:
        chapters = split_chapters("第一段结束。\n第二段结束。\n第三段结束。")

        self.assertEqual(chapters[0]["paras"], ["第一段结束。", "第二段结束。", "第三段结束。"])

    def test_uses_indentation_as_paragraph_boundary(self) -> None:
        text = "　　第一段从这里开始，\n这一行没有句末标点\n　　第二段从这里开始，\n也继续写完。"

        chapters = split_chapters(text)

        self.assertEqual(
            chapters[0]["paras"],
            ["第一段从这里开始，这一行没有句末标点", "第二段从这里开始，也继续写完。"],
        )


if __name__ == "__main__":
    unittest.main()

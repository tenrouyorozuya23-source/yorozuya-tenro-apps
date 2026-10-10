"""DVD文字データ(.docx)から credits.txt を作る。

1段落 = 1行。空段落・空白だけの段落は空行（余白）として残す。
Cast 行は「氏名（最初の2語）」と「役名」に分け、全角スペース2つでつなぐ。
使い方: python3 docx_to_credits.py 入力.docx > credits.txt
"""
import re
import sys
import zipfile

CJK = re.compile(r'[　-ヿ㐀-鿿＀-￯]')


def paragraphs(path):
    xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8')
    body = xml.split('<w:body>', 1)[1]
    for p in re.findall(r'<w:p[ >].*?</w:p>|<w:p/>', body, re.S):
        p = re.sub(r'<w:tab/>', '<w:t>\t</w:t>', p)
        yield ''.join(re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>', p))


def normalize(text):
    """前後の空白を除き、内部の空白の連続を1つにまとめる。
    元が全角スペースを含むか、和文どうしの間なら全角、それ以外は半角。"""
    tokens = re.split(r'(\s+)', text.strip())
    out = tokens[0]
    for i in range(1, len(tokens) - 1, 2):
        ws, prev, cur = tokens[i], tokens[i - 1], tokens[i + 1]
        fullwidth = '\u3000' in ws or (CJK.search(prev[-1]) and CJK.search(cur[0]))
        out += ('\u3000' if fullwidth else ' ') + cur
    return out


def main(path):
    in_cast = False
    lines = []
    for raw in paragraphs(path):
        line = normalize(raw)
        if line.startswith('【'):
            in_cast = line == '【Cast】'
        elif in_cast and line:
            words = line.split()
            line = '　'.join(words[:2]) + '　　' + '　'.join(words[2:])
        lines.append(line)
    while lines and not lines[0]:
        lines.pop(0)
    while lines and not lines[-1]:
        lines.pop()
    print('\n'.join(lines))


if __name__ == '__main__':
    main(sys.argv[1])

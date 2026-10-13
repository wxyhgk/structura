import { sceneToSvg } from "@structura/core/draw"
import { zip } from "../zip.ts"
import { tableMolecule } from "./compoundTable.ts"
import { rowName, type Row } from "./results.ts"

// 导出 Word without chem2office: the table of compounds as a .docx made in the page, each
// structure a picture (PNG), so it opens anywhere but is not a ChemDraw object to edit. The
// layout is chem2office's: `columns` to a row, a row of structures then a row of their numbers,
// the two kept on one page, no borders; every structure at one scale, the widest filling its column.

/** A structure's picture: PNG bytes and the SVG's own size in px (a bond is BOND_PX). */
export type Picture = { png: Uint8Array; width: number; height: number }
/** Turns SVG into a picture; in the page, by drawing it on a canvas (svgToPng). */
export type Rasterize = (svg: string) => Promise<Picture>

/** A bond in the SVG, and the same bond as ChemDraw prints it (ACS 1996), so pictures and objects come out alike. */
const BOND_PX = 40
const BOND_PT = 14.4
/** A4, 2.54 cm margins, in twentieths of a point (twips); the text is 9026 twips (451 pt) wide. */
const PAGE = { width: 11906, height: 16838, margin: 1440 }
const TEXT_PT = (PAGE.width - 2 * PAGE.margin) / 20
/** Room in a cell around its picture, and the most a structure is enlarged. */
const CELL_FILL = 0.92
const MAX_SCALE = 1.5
const EMU_PER_PT = 12700

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const NS = {
  w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  pic: "http://schemas.openxmlformats.org/drawingml/2006/picture",
}

/** The scale every picture gets: the widest structure filling its column, no more than MAX_SCALE. */
export function tableScale(widthsPx: readonly number[], columns: number): number {
  const widest = Math.max(1, ...widthsPx) * (BOND_PT / BOND_PX)
  return Math.min(MAX_SCALE, ((TEXT_PT / columns) * CELL_FILL) / widest)
}

function picture(index: number, name: string, size: { cx: number; cy: number }): string {
  const id = index + 1
  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${size.cx}" cy="${size.cy}"/>` +
    `<wp:docPr id="${id}" name="${escape(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="${NS.pic}"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${escape(name)}.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="rIdImage${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${size.cx}" cy="${size.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  )
}

const cell = (width: number, content: string, keepNext: boolean, valign: "bottom" | "top") =>
  `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="${valign}"/></w:tcPr>` +
  `<w:p><w:pPr>${keepNext ? "<w:keepNext/>" : ""}<w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>${content}</w:p></w:tc>`

const number = (text: string) =>
  `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="SimSun"/><w:b/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r>`

/** The rows (numbered) as a .docx of pictures, `columns` to a row. */
export async function pictureDocx(rows: readonly Row[], columns: number, rasterize: Rasterize): Promise<Uint8Array<ArrayBuffer>> {
  const pictures = await Promise.all(rows.map((row) => rasterize(sceneToSvg(tableMolecule(row.mol), false))))
  const scale = tableScale(pictures.map((item) => item.width), columns)
  const emu = (px: number) => Math.round(px * (BOND_PT / BOND_PX) * scale * EMU_PER_PT)
  const column = Math.floor((PAGE.width - 2 * PAGE.margin) / columns)
  const tableRows: string[] = []
  for (let start = 0; start < rows.length; start += columns) {
    const group = rows.slice(start, start + columns)
    const blanks = columns - group.length
    const structures = group.map((row, offset) => cell(column, picture(start + offset, rowName(row), { cx: emu(pictures[start + offset].width), cy: emu(pictures[start + offset].height) }), true, "bottom"))
    const numbers = group.map((row) => cell(column, number(rowName(row)), false, "top"))
    const empty = Array.from({ length: blanks }, () => cell(column, "", false, "top"))
    tableRows.push(`<w:tr><w:trPr><w:cantSplit/></w:trPr>${[...structures, ...empty].join("")}</w:tr>`)
    tableRows.push(`<w:tr><w:trPr><w:cantSplit/></w:trPr>${[...numbers, ...empty].join("")}</w:tr>`)
  }
  const none = ["top", "left", "bottom", "right", "insideH", "insideV"].map((side) => `<w:${side} w:val="nil"/>`).join("")
  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}"><w:body>` +
    `<w:tbl><w:tblPr><w:tblW w:w="${column * columns}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>${none}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${Array.from({ length: columns }, () => `<w:gridCol w:w="${column}"/>`).join("")}</w:tblGrid>${tableRows.join("")}</w:tbl>` +
    `<w:p/><w:sectPr><w:pgSz w:w="${PAGE.width}" w:h="${PAGE.height}"/><w:pgMar w:top="${PAGE.margin}" w:right="${PAGE.margin}" w:bottom="${PAGE.margin}" w:left="${PAGE.margin}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>` +
    `</w:body></w:document>`
  const relationships = pictures
    .map((_, index) => `<Relationship Id="rIdImage${index + 1}" Type="${NS.r}/image" Target="media/image${index + 1}.png"/>`)
    .join("")
  return zip([
    {
      path: "[Content_Types].xml",
      contents:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>` +
        `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    {
      path: "_rels/.rels",
      contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS.r}/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    { path: "word/document.xml", contents: document },
    { path: "word/_rels/document.xml.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>` },
    ...pictures.map((item, index) => ({ path: `word/media/image${index + 1}.png`, contents: item.png })),
  ])
}

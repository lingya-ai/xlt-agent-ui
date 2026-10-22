// ExcelJS 4.4 仅识别 commentsN.xml 和 vmlDrawingN.vml；在预览副本中统一批注部件命名
import JSZip from 'jszip'

const commentsContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml'

/** 兼容第三方生成器的批注路径，保留批注内容且不修改下载源 */
export async function normalizeExcelComments(source: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(source)
  const contentTypesFile = zip.file('[Content_Types].xml')
  if (!contentTypesFile) return source

  const parser = new DOMParser()
  const serializer = new XMLSerializer()
  const contentTypes = parser.parseFromString(await contentTypesFile.async('string'), 'application/xml')
  const renames = new Map<string, string>()

  const rename = (path: string, prefix: string, extension: string) => {
    if (!zip.file(path) || renames.has(path)) return
    let index = 1
    let target = `${prefix}${index}.${extension}`
    while (zip.file(target) || [...renames.values()].includes(target)) {
      target = `${prefix}${++index}.${extension}`
    }
    renames.set(path, target)
  }

  for (const override of contentTypes.getElementsByTagNameNS('*', 'Override')) {
    const path = override.getAttribute('PartName')?.replace(/^\//, '')
    if (path && override.getAttribute('ContentType') === commentsContentType && !/^xl\/comments\d+\.xml$/.test(path)) {
      rename(path, 'xl/comments', 'xml')
    }
  }
  for (const path of Object.keys(zip.files)) {
    if (path.endsWith('.vml') && !/^xl\/drawings\/vmlDrawing\d+\.vml$/.test(path)) {
      rename(path, 'xl/drawings/vmlDrawing', 'vml')
    }
  }
  if (renames.size === 0) return source

  // 关系路径相对于所属部件，不是 _rels 目录；同步更新绝对和相对引用
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !entry.name.endsWith('.rels')) continue
    const base = entry.name.replace(/_rels\/[^/]+\.rels$/, '')
    const relationships = parser.parseFromString(await entry.async('string'), 'application/xml')
    let changed = false
    for (const rel of relationships.getElementsByTagNameNS('*', 'Relationship')) {
      const target = rel.getAttribute('Target')
      if (!target || rel.getAttribute('TargetMode') === 'External') continue
      const path = decodeURI(new URL(target, `https://xlsx.invalid/${base}`).pathname).slice(1)
      const renamed = renames.get(path)
      if (!renamed) continue
      const directory = base.split('/').filter(Boolean)
      const parts = renamed.split('/')
      while (directory.length && directory[0] === parts[0]) {
        directory.shift()
        parts.shift()
      }
      rel.setAttribute('Target', '../'.repeat(directory.length) + parts.join('/'))
      changed = true
    }
    if (changed) zip.file(entry.name, serializer.serializeToString(relationships))
  }

  for (const override of contentTypes.getElementsByTagNameNS('*', 'Override')) {
    const path = override.getAttribute('PartName')?.replace(/^\//, '')
    const renamed = path && renames.get(path)
    if (renamed) override.setAttribute('PartName', `/${renamed}`)
  }
  zip.file('[Content_Types].xml', serializer.serializeToString(contentTypes))
  for (const [path, target] of renames) {
    const entry = zip.file(path)
    if (!entry) continue
    zip.file(target, await entry.async('uint8array'))
    zip.remove(path)
  }
  return zip.generateAsync({type: 'arraybuffer'})
}

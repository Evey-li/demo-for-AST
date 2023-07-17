
// 定义文本模式，作为一个状态表
const TextModes = {
  DATA: 'DATA',
  RCDATA: 'RCDATA',
  RAWTEXT: 'RAWTEXT',
  CDATA: 'CDATA'
}
const NodeTypes = {
  ROOT: 'ROOT',
  TEXT: 'TEXT',
  ELEMENT: 'ELEMENT'
}
const TagType = {
  Start: 'Start',
  End: 'End'
}

const ElementTypes = {
  ELEMENT: 'Element'
}

function createParserContext(content, options) {
  return {
    originalSource: content,
    source: content,
    options
  };
}

function createRoot(children, loc = {
  source: '',
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 }
}) {
  return {
    type: NodeTypes.ROOT,
    children
  };
}

function isEnd(context, mode, ancestors) {
  const s = context.source

  switch (mode) {
    case TextModes.DATA:
      if (startsWith(s, '</')) {
        // TODO: probably bad performance
        for (let i = ancestors.length - 1; i >= 0; --i) {
          if (startsWithEndTagOpen(s, ancestors[i].tag)) {
            return true
          }
        }
      }
      break

    case TextModes.RCDATA:
    case TextModes.RAWTEXT: {
      const parent = last(ancestors)
      if (parent && startsWithEndTagOpen(s, parent.tag)) {
        return true
      }
      break
    }

    case TextModes.CDATA:
      if (startsWith(s, ']]>')) {
        return true
      }
      break
  }
  return !s;
}

function startsWith(source, searchString) {
  return source.startsWith(searchString)
}

function startsWithEndTagOpen(source, tag) {
  console.log(source)
  console.log(startsWith(source, '</'))
  console.log(source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase())
  console.log(/[\t\r\n\f />]/.test(source[2 + tag.length] || '>'))
  return (
    startsWith(source, '</') &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
  )
}

function advanceBy(context, numberOfCharacters) {
  const { source } = context
  context.source = source.slice(numberOfCharacters)
}

function parseElement(context, ancestors) {
  const parent = ancestors[ancestors.length - 1]
  console.log("pre", context.source)
  const element = parseTag(context, TagType.Start, ancestors[ancestors.length - 1])

  ancestors.push(element)
  let mode = '' //context.options.getTextMode(element, parent)
  if (element.tag === 'textarea' || element.tag === 'title') {
    mode = TextModes.RCDATA
  } else if (/style|xmp|iframe|noembed|noframes|noscript/.test(element.tag)) {
    mode = TextModes.RAWTEXT
  } else {
    mode = TextModes.DATA
  }
  const children = parseChildren(context, mode, ancestors)
  ancestors.pop()
  element.children = children
  console.log("after", context.source)
  console.log(element.tag, startsWithEndTagOpen(context.source, element.tag))
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End, parent)
  }
  return element
}

function parseTextData(context, length, mode) {
  const rawText = context.source.slice(0, length)
  advanceBy(context, length)
  if (
    mode === TextModes.RAWTEXT ||
    mode === TextModes.CDATA ||
    !rawText.includes('&')
  ) {
    return rawText
  }
}

function parseText(context, mode) {
  const endTokens = mode === TextModes.CDATA ? [']]>'] : ['<', `{{`]
  let endIndex = context.source.length
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1)
    if (index !== -1 && endIndex > index) {
      endIndex = index
    }
  }

  const content = parseTextData(context, endIndex, mode)
  return {
    type: NodeTypes.TEXT,
    content
  }
}


function parseTag(context, type, parent) {
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)
  advanceBy(context, match[0].length)

  // Tag close.
  let isSelfClosing = false
  if (context.source.length === 0) {
    console.log('template字符串长度为0')
  } else {
    isSelfClosing = startsWith(context.source, '/>')
    advanceBy(context, isSelfClosing ? 2 : 1)
  }

  return {
    type: NodeTypes.ELEMENT,
    tag: match[1],
    tagType: ElementTypes.ELEMENT,
    isSelfClosing,
    children: []
  }
}

function parseChildren(context, mode, ancestors) {
  const nodes = []
  while (!isEnd(context, mode, ancestors)) {
    const s = context.source
    let node = undefined
    if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
      if (mode === TextModes.DATA && s[0] === '<') {
        if (s.length === 1) {
          console.log("error template")
        }
        if (s[1] === '/') {
          if (s[2] === '>') {
            advanceBy(context, 3)
            continue
          } else
            if (/[a-z]/i.test(s[2])) {
              parseTag(context, TagType.End, parent)
              continue
            }
        }
        if (/[a-z]/i.test(s[1])) {
          node = parseElement(context, ancestors)
        }
      }
    }
    if (!node) {
      node = parseText(context, mode)
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        nodes.push(node[i])
      }
    } else {
      nodes.push(node)
    }
  }

  let removedWhitespace = false
  return removedWhitespace ? nodes.filter(Boolean) : nodes
}

function baseParse(content, options) {
  const context = createParserContext(content, options)
  return createRoot(
    parseChildren(context, TextModes.DATA, [])
  )
}

const template = `<div><p>Text1</p><p>Text2</p></div>`
const ast = baseParse(template)
import { unicodeRegExp, makeMap } from '../vue2/util/index.js'
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
const qnameCapture = `((?:${ncname}\\:)?${ncname})`

const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)

export const isPlainTextElement = makeMap('script,style,textarea', true)

export function createASTElement(tag, attrs , parent) {
  return {
    type: 1,
    tag,
    attrsList: attrs,
    parent,
    children: []
  }
}

function parse(template) {
  debugger
  const stack = []
  let root
  let currentParent

  function closeElement(element) {
    if (!stack.length && element !== root) {
      return
    }
    if (currentParent) {
      currentParent.children.push(element)
      element.parent = currentParent
    }
  }

  parseHtml(template, {
    start(tag, attrs, unary, start, end) {
      let element = createASTElement(tag, attrs, currentParent)
      if (!root) {
        root = element
      }
      if (!unary) {
        currentParent = element
        stack.push(element)
      } else {
        closeElement(element)
      }
    },
    end(tag, start, end) {
      const element = stack[stack.length - 1]
      // pop
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      closeElement(element)
    },
    chars(text, start, end) {
      if(!currentParent) return
      const children = currentParent.children
      if (text) {
        let child = {
          type: 3,
          text
        }
        if (child) {
          child.start = start
          child.end = end
          children.push(child)
        }
      }
    }
  })
  console.log(root)
  return root
}

function parseHtml(html, options) {
  let index = 0
  let last, lastTag
  const stack = []
  while (html) {
    console.log('current html: ', html)
    last = html
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // End tag:
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }
        // Start tag:
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          continue
        }

      }
      let text
      if (textEnd >= 0) {
        text = html.substring(0, textEnd)
      }
      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)
      }

      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {

    }
  }

  function advance(n) {
    index += n
    html = html.substring(n)
  }

  function parseStartTag() {
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end = html.match(startTagClose)
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  function handleStartTag(match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash
    const unary = !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)

    if (!unary) {
      stack.push({
        tag: tagName,
        lowerCasedTag: tagName.toLowerCase(),
        attrs: attrs,
        start: match.start,
        end: match.end
      })
      lastTag = tagName
    }
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function parseEndTag(tagName, start, end) {
    let pos
    if (start == null) start = index
    if (end == null) end = index

    if (tagName) {
      let lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if(pos >= 0) {
      for (let i = stack.length - 1; i >= pos; i--) {
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    }
  }
}

const template = "<div><p>txt1</p><p>txt2</p></div>"
parse(template)

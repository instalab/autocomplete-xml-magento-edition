/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const xsd = require('./xsd');
const utils = require('./xml-utils');

const xmlValidation = /xmlns:xsi="http:\/\/www\.w3\.org\/2001\/XMLSchema-instance"/;
const xsdPattern = /xsi:noNamespaceSchemaLocation="(.+?)"/;
const xsdWithNamespacePattern = /xsi:schemaLocation="\S+\s+(.+?)"/;

module.exports = {
  // Enable for XML but not for XML comments.
  selector: '.text.xml',
  disableForSelector: '.text.xml .comment',

  // Take priority over the default provider.
  inclusionPriority: 1,
  excludeLowerPriority: true,

  // Last XSD url loaded - Load only once the XSD.
  // TODO: Create cache of XSDs.
  lastXsdUri: '',


  // Return a promise, an array of suggestions, or null.
  getSuggestions(options) {
    const newUri = this.getXsdUri(options);

    // If we don't found a URI maybe the file does not have XSD. Clean and exit.
    if (!newUri) {
      this.lastXsdUri = '';
      xsd.clear();
      return [];
    } else if (newUri === this.lastXsdUri) {
      return this.detectAndGetSuggestions(options);
    } else {
      return new Promise(resolve => {
        return xsd.load(options.editor.getPath(), newUri, () => {
          this.lastXsdUri = newUri;
          return resolve(this.detectAndGetSuggestions(options));
        });
      });
    }
  },


  detectAndGetSuggestions(options) {
    if (this.isTagName(options)) {
      return this.getTagNameCompletions(options);
    } else if (this.isCloseTagName(options)) {
      return this.getCloseTagNameCompletion(options);
    } else if (this.isAttributeValue(options)) {
      return this.getAttributeValueCompletions(options);
    } else if (this.isAttribute(options)) {
      return this.getAttributeCompletions(options);
    } else if (this.isTagValue(options)) {
      return this.getValuesCompletions(options);
    } else {
      return [];
    }
  },


  //# Get XSD URI
  getXsdUri({editor}) {
    // Get the XSD url only if the XML ask for validation.
    const txt = editor.getText();
    if (!txt.match(xmlValidation)) { return null; }
    
    // Try with noNamespaceSchemaLocation
    const xsdMatch = txt.match(xsdPattern);
    if (xsdMatch) { return (xsdMatch != null ? xsdMatch[1] : undefined); }

    // Try with schemaLocation
    const xsdWithNamespaceMatch = txt.match(xsdWithNamespacePattern);
    if (xsdWithNamespaceMatch) { return (xsdWithNamespaceMatch != null ? xsdWithNamespaceMatch[1] : undefined); }
  },

  //# Filter the candidate completions by prefix.
  filterCompletions(sugs, pref) {
    const completions = [];
    pref = pref != null ? pref.trim() : undefined;
    for (let s of Array.from(sugs)) {
      if (!pref || ((s.text != null ? s.text : s.snippet).indexOf(pref) !== -1)) {
        completions.push(this.buildCompletion(s));
      }
    }
    return completions;
  },


  //# Build the completion from scratch. In this way the object doesn't
  //# contain attributes from previous autocomplete-plus processing.
  buildCompletion(value) {
    return {
      text: value.text,
      snippet: value.snippet,
      displayText: value.displayText,
      description: value.description,
      type: value.type,
      rightLabel: value.rightLabel,
      leftLabel: value.leftLabel
    };
  },


  //# Checks if the current cursor is on a incomplete tag name.
  isTagName({editor, bufferPosition, prefix}) {
    const {row, column} = bufferPosition;
    const tagPos = column - prefix.length - 1;
    const tagChars = editor.getTextInBufferRange([[row, tagPos], [row, tagPos + 1]]);
    return (tagChars === '<') || (prefix === '<');
  },


  //# Get the tag name completion.
  getTagNameCompletions({editor, bufferPosition, prefix}) {
    // Get the children of the current XPath tag.
    const children = xsd.getChildren(
      utils.getXPathWithPrefix(editor.getBuffer(), bufferPosition, prefix));

    // Apply a filter with the current prefix and return.
    return this.filterCompletions(children, (prefix === '<' ? '' : prefix));
  },


  //# Checks if the current cursor is to close a tag.
  isCloseTagName({editor, bufferPosition, prefix}) {
    const {row, column} = bufferPosition;
    const tagClosePos = column - prefix.length - 2;
    const tagChars = editor.getTextInBufferRange(
      [[row, tagClosePos], [row, tagClosePos + 2]]);
    return tagChars === "</";
  },


  //# Get the tag name that close the current one.
  getCloseTagNameCompletion({editor, bufferPosition, prefix}) {
    const buffer = editor.getBuffer();
    let parentTag = utils.getXPathWithPrefix(buffer, bufferPosition, prefix, 1);
    parentTag = parentTag[parentTag.length - 1];
    return [{
      text: parentTag + '>',
      displayText: parentTag,
      type: 'tag',
      rightLabel: 'Tag'
    }];
  },


  //# Checks if the current cursor is about complete values.
  isTagValue({scopeDescriptor}) {
    // For multiline values we can only check text.xml
    return scopeDescriptor.getScopesArray().indexOf('text.xml') !== -1;
  },


  //# Get the values of the current XPath tag.
  getValuesCompletions({editor, bufferPosition, prefix}) {
    // Get the children of the current XPath tag.
    const children = xsd.getValues(
      utils.getXPathWithPrefix(editor.getBuffer(), bufferPosition, ''));

    // Apply a filter with the current prefix and return.
    return this.filterCompletions(children, prefix);
  },


  //# Checks if the current cursor is about complete attributes.
  isAttribute({scopeDescriptor, editor, prefix, bufferPosition}) {
    let {row, column} = bufferPosition;
    column -= prefix.length;  // Remove the prefix to get the lastest char.
    const previousChar = editor.getTextInBufferRange([[row, column-1], [row, column]]);
    const scopes = scopeDescriptor.getScopesArray();
    return ((scopes.indexOf('meta.tag.xml') !== -1) ||
      (scopes.indexOf('meta.tag.no-content.xml') !== -1)) &&
      (previousChar !== '>') && (previousChar !== '.');
  },  // Avoid false-positives


  //# Get the attributes for the current XPath tag.
  getAttributeCompletions({editor, bufferPosition, prefix}) {
    // Get the attributes of the current XPath tag.
    const attributes = xsd.getAttributes(
      utils.getXPathWithPrefix(editor.getBuffer(), bufferPosition, ''));

    // Apply a filter with the current prefix and return.
    return this.filterCompletions(attributes, prefix);
  },

  //# Check if the cursor is about complete the value of an attribute.
  isAttributeValue({scopeDescriptor, prefix}) {
    const scopes = scopeDescriptor.getScopesArray();
    return scopes.indexOf('string.quoted.double.xml') !== -1;
  },

  //# Get the attribute values.
  getAttributeValueCompletions({editor, prefix, bufferPosition}) {
    let matches;
    const {row, column} = bufferPosition;

    // Get the attribute name
    const line = editor.getTextInBufferRange([[row, 0], [row, column-prefix.length]]);
    const attrNamePattern = /[\.\-:_a-zA-Z0-9]+=/g;
    let attrName = (matches = __guard__(line.match(attrNamePattern), x => x.reverse()[0]));
    attrName = attrName.slice(0, -1);

    // Get the XPath
    const xpath = utils.getXPathWithPrefix(editor.getBuffer(), bufferPosition, '');

    // Get the children of the XPath
    const children = xsd.getAttributeValues(xpath, attrName);

    // Apply a filter with the current prefix and return.
    return this.filterCompletions(children, prefix);
  }
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
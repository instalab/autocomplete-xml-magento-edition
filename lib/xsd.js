/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const xsdParser = require('./xsdParser');

module.exports = {
  types: {},


  //# Clear the data. This is the case of changing the XSD.
  clear() {
    return this.types = {};
  },


  //# Load a new XSD.
  load(xmlPath, xsdUri, complete) {
    
    // Get the protocol used to download the file.
    let protocol = null;
    if (xsdUri.substr(0, 7) === "http://") {
      protocol = require('http');
    } else if (xsdUri.substr(0, 8) === "https://") {
      protocol = require('https');
    }
    
    if (protocol) {
      // Download the file
      return protocol.get(xsdUri, res => {
        let body = '';
        res.on('data', chunk => body += chunk);

        // On complete, parse XSD
        return res.on('end', () => {
          return this.parseFromString(body, complete);
      });
      }).on('error', e => console.error(e));
    } else {
      let basePath;
      const path = require('path');
      // Get the base path. In absolute path nothing, in relative the file dir.
      const winRoot = xsdUri.length > 3 ? xsdUri.substr(1, 2) : '';
      if ((xsdUri[0] === '/') || [':/', ':\\'].includes(winRoot)) {
        basePath = '';
      } else if (xsdUri.startsWith('file:///')) {
        basePath = '';
        xsdUri = xsdUri.slice(8);
      } else if (xsdUri.startsWith('urn:')) {
        const magentoVendorPath = atom.config.get('autocomplete-xml-magento-edition.zmagentoVendorPath')
        const parts = xsdUri.split(':')
        const vendor = parts[1]
        const module = parts[2]
        
        basePath = path.join(magentoVendorPath, vendor, module)
        xsdUri = parts[3]
      } else {
        basePath = path.dirname(xmlPath);
      }
      
      // Read the file from disk
      const fs = require('fs');
      return fs.readFile(path.join(basePath, xsdUri), (err, data) => {
        if (err) {
          return console.error(err);
        } else if (!data) {
          return console.error('Cannot get content from XSD file');
        } else {
          return this.parseFromString(data, complete);
        }
      });
    }
  },


  //# Parse the the XML
  parseFromString(data, complete) {
    this.types = xsdParser.types;
    xsdParser.parseFromString(data);
    return complete();
  },


  //# Called when suggestion requested. Get all the possible node children.
  getChildren(xpath) {
    // If there is no path, we need a root node first!
    if (xpath.length === 0) {
      return ((() => {
        const result = [];
        for (let name in xsdParser.roots) {
          const value = xsdParser.roots[name];
          result.push(value);
        }
        return result;
      })());
    }

    // Get the XSD type name from the tag name.
    const type = this.findTypeFromXPath(xpath);
    if (!type || (type.xsdType !== 'complex')) {
      return [];
    }

    // Create list of suggestions from childrens
    // TODO: Represent groups in autocompletion
    const suggestions = [];
    for (let group of Array.from(type.xsdChildren)) {
      for (let el of Array.from(group.elements)) { suggestions.push(this.createChildSuggestion(el)); }
    }

    // Remove undefined elements (e.g.: non-supported yet types).
    return suggestions.filter(n => n !== undefined);
  },


  //# Search the type from the XPath
  findTypeFromXPath(xpath) {
    let type = xsdParser.roots[xpath[0]];
    xpath.shift();  // Remove root node.

    while (xpath && (xpath.length > 0) && type) {
      const nextTag = xpath.shift();
      const nextTypeName = this.findTypeFromTag(nextTag, type);
      type = this.types[nextTypeName];
    }

    return type;
  },


  //# Search for the XSD type name by using the tag name.
  findTypeFromTag(tagName, node) {
    for (let group of Array.from(node.xsdChildren)) {
      for (let el of Array.from(group.elements)) {
        if (el.tagName === tagName) { return el.xsdTypeName; }
      }
    }
  },


  //# Create a suggestion object from a child object.
  createChildSuggestion(child) {
    // The suggestion is a merge between the general type info and the
    // specific information from the child object.
    let sug;
    const childType = this.types[child.xsdTypeName];

    // Create the snippet
    let snippet = child.tagName;

    // Add the must-be attributes
    let snippetId = 1;
    for (let attr of Array.from(((childType != null ? childType.xsdAttributes : undefined) || []))) {
      if (attr.use === 'required') {var left;
      
        snippet += ` ${attr.name}=\"`;
        snippet += `\${${snippetId++}:${((left = attr.fixed != null ? attr.fixed : attr.default)) != null ? left : ''}}\"`;
      }
    }
    snippet += ">";

    // Add the closing tag if so
    const closingConfig = atom.config.get('autocomplete-xml-magento-edition.addClosingTag');
    if (closingConfig) { snippet += `\${${snippetId++}:}</` + child.tagName + '>'; }

    // Create the suggestion
    return sug = {
      snippet,
      displayText: child.tagName,
      description: child.description != null ? child.description : (childType != null ? childType.description : undefined),
      type: 'tag',
      rightLabel: 'Tag',
      leftLabel: (childType != null ? childType.leftLabel : undefined) != null ? (childType != null ? childType.leftLabel : undefined) : (!childType ? child.xsdTypeName : undefined)
    };
  },


  //# Get the values from a tag.
  getValues(xpath) {
    // Get the XSD type name from the tag name.
    const type = this.findTypeFromXPath(xpath);
    if (!type || (type.xsdType !== 'simple')) {
      return [];
    }

    // Create list of suggestions from childrens
    // TODO: Represent groups in autocompletion
    const suggestions = [];
    for (let group of Array.from(type.xsdChildren)) {
      for (let el of Array.from(group.elements)) { suggestions.push(this.createValueSuggestion(el)); }
    }

    // Remove undefined elements (e.g.: non-supported yet types).
    return suggestions.filter(n => n !== undefined);
  },


  //# Get attribute value.
  getAttributeValues(xpath, attrName) {
    // Get the XSD type name of the tag name
    const type = this.findTypeFromXPath(xpath);
    if (!type) {
      return [];
    }

    // Get the attribute type
    const attribute = (Array.from(type.xsdAttributes).filter((attr) => attr.name === attrName));
    const attrType = this.types[attribute[0] != null ? attribute[0].type : undefined];
    if (!attrType) {
      return [];
    }

    // Create list of suggestions from childrens
    // TODO: Represent groups in autocompletion
    const suggestions = [];
    for (let group of Array.from(attrType.xsdChildren)) {
      for (let el of Array.from(group.elements)) { suggestions.push(this.createValueSuggestion(el)); }
    }

    // Remove undefined elements (e.g.: non-supported yet types).
    return suggestions.filter(n => n !== undefined);
  },

  //# Create a suggestion from the tag values.
  createValueSuggestion(child) {
    return {
      text: child.tagName,
      displayText: child.tagName,
      type: 'value',
      rightLabel: 'Value'
    };
  },

  //# Called when suggestion requested for attributes.
  getAttributes(xpath) {
    // Get the XSD type name from the tag name.
    const type = this.findTypeFromXPath(xpath);
    if (!type) {
      return [];
    }

    // Create list of suggestions from attributes
    return (Array.from(type.xsdAttributes).map((attr) => this.createAttributeSuggestion(attr)));
  },


  //# Create a suggestion from the attribute.
  createAttributeSuggestion(attr) {
    let left;
    return {
      displayText: attr.name,
      snippet: attr.name + '="${1:' + (((left = attr.fixed != null ? attr.fixed : attr.default)) != null ? left : '') + '}"',
      description: attr.description,
      type: 'attribute',
      rightLabel: 'Attribute',
      leftLabel: attr.type
    };
  }
};

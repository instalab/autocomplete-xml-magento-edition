/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
module.exports = {
  // Expected type object from external modules.
  // type:
  //   text: The text for autocomplete. Set externally from child.tagName.
  //   displayText: Same as text but text may contain closing tags, etc...
  //   description: Documentation info. It can be empty.
  //   type: The autocomplete type.
  //   rightLabel: The autocomplete right libel. The XML type of element.
  //   leftLabel: The type of the value.
  //
  //   xsdType: The XSD type (e.g.: complex, simple, attribute).
  //   xsdTypeName: The name inside the XSD.
  //   xsdChildrenMode: The order of the children: all, sequence or choice.
  //   xsdChildren: References to other types. They are in groups.
  //     childType: The type of children nodes group: element, sequence or choice
  //     ref: Only for groups. Group name with the elements.
  //     description: Optionally. Not sure where it will fit.
  //     minOccurs: The group of children must appear at least...
  //     maxOccurs: The group of children cann't appear more than ...
  //     elements: The elements of the group (they must be elements tags).
  //       tagName: The name of the tag.
  //       xsdTypeName: the type name inside the XSD.
  //       description: Optionally. It has priority over type.description.
  //       minOccurs: The children must appear at least ...
  //       maxOcurrs: The children cann't appear more than ...
  //  xsdAttributes: The attributes of the element.
  //    name: The attribute name.
  //    type: The attribute type.
  //    description: Optional. The attribute documentation.
  //    fixed: Optional. The fixed value of the attribute.
  //    use: If the attribute must be present or not. Default: false.
  //    default: Thea attribute default value.
  types: {},
  roots: {},
  attributeGroups: {},

  parseFromString(xmlString, complete) {
    const xml2js = require('xml2js');
    return xml2js.parseString(xmlString, {
      tagNameProcessors: [xml2js.processors.stripPrefix], // Strip nm prefix
      preserveChildrenOrder: true,
      explicitChildren: true
      }, (err, result) => {
        if (err) {
          return console.error(err);
        } else if (!result) {
          return console.error("Empty XSD definition");
        } else {
          return this.parse(result, complete);
        }
    });
  },


  //# Parrse the XSD file. Prepare types and children.
  parse(xml, complete) {
    // Go to root node
    let schemaFound, value;
    xml = xml.schema;

    // Check that there is a schema
    if (!xml) {
      return;
    }

    // Check that the schema follow the standard
    for (var name in xml.$) {
      value = xml.$[name];
      if (value === "http://www.w3.org/2001/XMLSchema") {
        schemaFound = true;
      }
    }

    if (!schemaFound) {
      console.log("The schema doesn't follow the standard.");
      return;
    }

    // Check if there is at least one node in the schema definition
    if (!xml.$$) {
      console.log("The schema is empty.");
      return;
    }

    // Process all ComplexTypes and SimpleTypes
    for (var node of Array.from(xml.$$)) { this.parseType(node); }
    
    // Process the root node (Element type).
    if (xml.element) {
      for (node of Array.from(xml.element)) { this.parseRoot(node); }
    }
    
    // Process includes
    if (xml.include) {
      for (node of Array.from(xml.include)) { this.parseInclude(node); }
    }
    
    // Copy root types into types since they could be used too.
    for (name in this.roots) { value = this.roots[name]; this.types[name] = value; }

    // Process all AttributeGroup (not regular types).
    for (node of Array.from((xml.attributeGroup != null ? xml.attributeGroup : []))) { this.parseAttributeGroup(node); }

    // Post parse the nodes and resolve links.
    return this.postParsing();
  },
  
  // Parse includes
  parseInclude(node) {
    require('./xsd').load('/', node.$.schemaLocation, () => {})
  },

  //# Parse a node type.
  parseType(node, typeName) {
    // Create a basic type from the common fields.
    const type = this.initTypeObject(node, typeName);
    if (!type.xsdTypeName) { return null; }

    // Parse by node type.
    const nodeName = node["#name"];
    if (nodeName === "simpleType") {
      return this.parseSimpleType(node, type);
    } else if (nodeName === "complexType") {
      return this.parseComplexType(node, type);
    } else if (nodeName === "group") {
      return this.parseGroupType(node, type);
    }
  },


  //# Remove new line chars and trim spaces.
  normalizeString(str) {
    return __guardMethod__(str, 'replace', o => o.replace(/[\n\r]/, '').trim());
  },


  //# Get documentation string from node
  getDocumentation(node) {
    return this.normalizeString(__guard__(node != null ? node.annotation : undefined, x => x[0].documentation[0]._) != null ? __guard__(node != null ? node.annotation : undefined, x => x[0].documentation[0]._) : __guard__(node != null ? node.annotation : undefined, x1 => x1[0].documentation[0]));
  },


  // Initialize a type object from a Simple or Complex type node.
  initTypeObject(node, typeName) {
    let type;
    return type = {
      // XSD params
      xsdType: '',
      xsdTypeName: typeName != null ? typeName : __guard__(node != null ? node.$ : undefined, x => x.name),
      xsdAttributes: [],
      xsdChildrenMode: '',
      xsdChildren: [],

      // Autocomplete params
      text: '',  // Set later
      displayText: '',  // Set later
      description: this.getDocumentation(node),
      type: 'tag',
      rightLabel: 'Tag'
    };
  },


  //# Parse a SimpleType.
  parseSimpleType(node, type) {
    let childrenNode;
    type.xsdType = 'simple';

    // Get the node that contains the children
    // TODO: Support list children.
    // TODO: Support more restriction types.
    if (node.restriction != null ? node.restriction[0].enumeration : undefined) {
      type.xsdChildrenMode = 'restriction';
      childrenNode = node.restriction[0];
      type.leftLabel = childrenNode.$.base;
    } else if (node.union) {
      type.xsdChildrenMode = 'union';
      type.leftLabel = node.union[0].$.memberTypes;
    }

    if (childrenNode) {
      const group = {
        childType: 'choice',
        description: '',
        minOccurs: 0,
        maxOccurs: 'unbounded',
        elements: []
      };
      type.xsdChildren.push(group);

      for (let val of Array.from(childrenNode.enumeration)) {
        group.elements.push({
          tagName: val.$.value,
          xsdTypeName: null,
          description: '',
          minOccurs: 0,
          maxOccurs: 1
        });
      }
    }

    this.types[type.xsdTypeName] = type;
    return type;
  },


  //# Parse a ComplexType node and children.
  parseComplexType(node, type) {
    type.xsdType = 'complex';

    // Get the node that contains the children.
    let childrenNode = null;
    if (node.sequence) {
      type.xsdChildrenMode = 'sequence';
      childrenNode = node.sequence[0];
    } else if (node.choice) {
      type.xsdChildrenMode = 'choice';
      childrenNode = node.choice[0];
    } else if (node.all) {
      type.xsdChildrenMode = 'all';
      childrenNode = node.all[0];
    } else if (node.complexContent != null ? node.complexContent[0].extension : undefined) {
      type.xsdChildrenMode = 'extension';
      type.xsdChildren = node.complexContent[0].extension[0];
    } else if (node.group) {
      type.xsdChildrenMode = 'group';
      type.xsdChildren = node.group[0];
    }

    // The children are in groups of type: element, sequence or choice.
    if (childrenNode) {
      type.xsdChildren =
        (this.parseChildrenGroups(childrenNode.element, 'element'))
        .concat((this.parseChildrenGroups(childrenNode.choice, 'choice')))
        .concat((this.parseChildrenGroups(childrenNode.sequence, 'sequence')))
        .concat((this.parseChildrenGroups(childrenNode.group, 'group')));
    }

    if (node.attribute) {
      type.xsdAttributes = (Array.from(node.$$).map((n) => this.parseAttribute(n))).filter(Boolean);
    }

    this.types[type.xsdTypeName] = type;
    return type;
  },


  //# Parse the group of children nodes.
  parseChildrenGroups(groupNodes, mode) {
    if (!groupNodes) {
      return [];
    }

    // For each element/sequence/choice node, create a group object.
    const groups = [];
    for (let node of Array.from(groupNodes)) {
      groups.push({
        childType: mode,
        ref: (node.$ != null ? node.$.ref : undefined),
        description: this.getDocumentation(node),
        minOccurs: (node.$ != null ? node.$.minOccurs : undefined) != null ? (node.$ != null ? node.$.minOccurs : undefined) : 0,
        maxOccurs: (node.$ != null ? node.$.maxOccurs : undefined) != null ? (node.$ != null ? node.$.maxOccurs : undefined) : 'unbounded',

        // If the mode is element, the elements is itself.
        elements: mode === 'element' ? [].concat(this.parseElement(node)) :
          ((Array.from(node.element != null ? node.element : [])).map((childNode) => this.parseElement(childNode)))
      });
    }
    return groups;
  },


  // Parse the simple type defined inside a node with a random UUID.
  parseAnonElements(node) {
    // Create a randome type name and parse the child.
    // Iterate to skip "annotation", etc. It should ignore all except one.
    const randomName = require('uuid')();
    for (let childNode of Array.from(node.$$)) { this.parseType(childNode, randomName); }
    return randomName;
  },


  //# Parse a child node.
  parseElement(node) {
    const child = {
      tagName: node.$.name != null ? node.$.name : node.$.ref,
      xsdTypeName: node.$.type != null ? node.$.type : node.$.ref,
      minOccurs: node.$.minOccurs != null ? node.$.minOccurs : 0,
      maxOccurs: node.$.maxOccurs != null ? node.$.maxOccurs : 'unbounded',
      description: this.getDocumentation(node)
    };

    // If the element type is defined inside.
    if (!child.xsdTypeName && node.$$) {
      child.xsdTypeName = this.parseAnonElements(node);
    }

    return child;
  },

  //# Parse attributes.
  parseAttribute(node) {
    const nodeName = node["#name"];
    if ((nodeName === "attribute") && (node.$.use !== "prohibited")) {
      const attr = {
        name: node.$.name,
        type: node.$.type,
        description: this.getDocumentation(node),
        fixed: node.$.fixed,
        use: node.$.use,
        default: node.$.default
      };

      // If the attribute type is defined inside.
      if (!node.$.type && node.$$) {
        attr.type = this.parseAnonElements(node);
      }
      return attr;
    } else if (nodeName === "attributeGroup") {
      return {ref: node.$.ref};
    } else {
      return null;
    }
  },


  //# Parse a AttributeGroup node.
  parseAttributeGroup(node) {
    const { name } = node.$;
    const attributes = (Array.from(node.$$).map((xattr) => this.parseAttribute(xattr))).filter(Boolean);
    return this.attributeGroups[name] = attributes;
  },


  //# Parse a group node.
  parseGroupType(node, type) {
    return this.parseComplexType(node, type);
  },


  //# Parse the root node.
  parseRoot(node) {
    // First parse the node as a element
    const rootElement = this.parseElement(node);
    const rootTagName = rootElement.tagName;
    const rootType = this.types[rootElement.xsdTypeName];

    // Now create a complex type.
    const root = this.initTypeObject(null, rootElement.xsdTypeName);
    root.description = rootElement.description != null ? rootElement.description : (rootType != null ? rootType.description : undefined);
    root.text = rootTagName;
    root.displayText = rootTagName;
    root.type = 'class';
    root.rightLabel = 'Root';
    root.xsdType = 'complex';

    // Copy the type into the root object.
    if (rootType) {
      root.xsdAttributes = rootType.xsdAttributes;
      root.xsdChildrenMode = rootType.xsdChildrenMode;
      root.xsdChildren = rootType.xsdChildren;
    }

    this.roots[rootTagName] = root;
    return root;
  },


  //# This takes place after all nodes have been parse. Allow resolve links.
  postParsing() {
    // Post process all nodes
    let attr;
    return (() => {
      const result = [];
      for (let name in this.types) {
      // If the children type is extension, resolve the link.
        var linkType;
        var type = this.types[name];
        if (type.xsdChildrenMode === 'extension') {
          const extenType = type.xsdChildren;
          const extenAttr = ((Array.from(extenType.$$ || [])).map((n) => this.parseAttribute(n)))
            .filter(Boolean);

          // Copy fields from base
          linkType = this.types[extenType.$.base];
          if (!linkType) {
            atom.notifications.addError(`can't find base type ${extenType.$.base}`);
            continue;
          }

          type.xsdTypeName = linkType.xsdTypeName;
          type.xsdChildrenMode = linkType.xsdChildrenMode;
          type.xsdChildren = linkType.xsdChildren;
          type.xsdAttributes = extenAttr.concat(linkType.xsdAttributes);
          if (type.description == null) { type.description = linkType.description; }
          type.type = linkType.type;
          type.rightLabel = linkType.rightLabel;

        // If it's a group, resolve the link
        } else if (type.xsdChildrenMode === 'group') {
          const groupType = type.xsdChildren;

          // Copy the children
          linkType = this.types[groupType.$.ref];
          type.xsdChildren = linkType.xsdChildren;
          type.xsdChildrenMode = linkType.xsdChildrenMode;

        // If it's an union, merge the single types
        } else if (type.xsdChildrenMode === 'union') {
          const unionTypes = type.leftLabel.split(' ');
          type.xsdChildrenMode = 'restriction';
          for (let t of Array.from(unionTypes)) {
            const memberType = this.types[t];
            if (memberType) { type.xsdChildren.push(memberType.xsdChildren[0]); }
          }
        }

        // At the moment, I think it only makes sense if it replaces all the
        // elements. Consider a group that contains a sequence of choice elements.
        // We don't support sequence->sequence(from group)->choide->elements.
        for (let group of Array.from(type.xsdChildren)) {
          if (group.childType === 'group') {
            linkType = this.types[group.ref];
            type.xsdChildren = linkType.xsdChildren;
            break;
          }
        }

        // Add the attributes from the group attributes
        const groups = ((() => {
          const result1 = [];
          for (attr of Array.from(type.xsdAttributes)) {             if (attr.ref) {
              result1.push(attr.ref);
            }
          }
          return result1;
        })());
        let attributes = [];
        for (attr of Array.from(type.xsdAttributes)) {
          if (attr.ref) {
            attributes = attributes.concat(this.attributeGroups[attr.ref]);
          } else {
            attributes.push(attr);
          }
        }
        result.push(type.xsdAttributes = attributes);
      }
      return result;
    })();
  }
};

function __guardMethod__(obj, methodName, transform) {
  if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
    return transform(obj, methodName);
  } else {
    return undefined;
  }
}
function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
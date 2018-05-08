# Autocomplete XML Atom Package (Magento Edition)

XML tag autocompletion for Atom text editor! **decaffeinated!**

![Demo](https://raw.githubusercontent.com/instalab/autocomplete-xml-magento-edition/master/demo.gif)

**NOTE:** For this to work you have to configure the path to Magento's vendor directory!

![Config](https://raw.githubusercontent.com/instalab/autocomplete-xml-magento-edition/master/config.png)

# Features
* Read XSD files from Magento locations like: ```xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd"```
* Evaluate ```xs:include``` tags

# Code structure
The package code is inside the *lib* folder.

* *lib*
    * **main.js**: Main package file. It handles package things like calling the provider and settings.
    * **provider.js**: Detects the type of suggestion needed (e.g.: tag, attribute, ...) and ask for suggestions of that type. It handles everything related with the editor.
    * **xsd.js**: Manage the XSD types. Create suggestions. It handles suggestion creation.
    * **xsdParser.js**: Download and parse a XSD file and build the types. It handles XSD parsing.
    * **xpath-statusbar-view.js**: Show the current XPath in the StatusBar.

[Original package](https://github.com/pleonex/atom-autocomplete-xml)
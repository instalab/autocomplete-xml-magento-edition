const provider = require('./provider')
const utils = require('./xml-utils')

module.exports = {
  xpathView: null,
  config: {
    showXPathInStatusBar: {
      title: 'Show XPath In Status Bar',
      description: 'Show in the status bar the current XPath for XML files.',
      type: 'boolean',
      default: true
    },
    addClosingTag: {
      title: 'Add Closing Tag',
      description: 'When enabled the closing tag is inserted too.',
      type: 'boolean',
      default: true
    },
    zmagentoVendorPath: {
      title: 'Magento vendor path',
      description: 'Path to Magento\'s vendor directory.',
      type: 'string',
      default: '/srv/http/magento/vendor'
    }
  },
  getProvider() {
    return provider 
  },
  activate(state) {
    const {CompositeDisposable} = require('atom')
    this.subscriptions = new CompositeDisposable()
    return this.subscriptions.add(atom.commands.add('atom-workspace',
      {'autocomplete-xml:copy-XPath-to-clipboard': () => this.copyXpathToClipboard()})
    )
  },
  deactivate() {
    if (this.xpathView != null) {
      this.xpathView.destroy()
    }
    this.xpathView = null
    if (this.subscriptions != null) {
      this.subscriptions.dispose()
    }
    return this.subscription = null
  },
  consumeStatusBar(statusBar) {
    const XPathStatusBarView = require('./xpath-statusbar-view')
    this.xpathView = new XPathStatusBarView().initialize(statusBar)
    return this.xpathView.attach()
  },
  copyXpathToClipboard() {
    const editor = atom.workspace.getActiveTextEditor()
    if (editor) {
      const buffer = editor.getBuffer()
      const bufferPosition = editor.getCursorBufferPosition()
      const xpath = utils.getXPathCompleteWord(buffer, bufferPosition)
      return atom.clipboard.write(xpath.join('/'))
    }
  }
}

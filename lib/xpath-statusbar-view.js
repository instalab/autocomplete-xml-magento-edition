/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {Disposable} = require('atom');
const utils = require('./xml-utils');

// XPath view in the status Bar.
// Create a label and append to the StatusBar. In order to update the content,
// subscribe to active panel changes and inside that to
// TextEditor cursor changes.
class XPathStatusBarView extends HTMLDivElement {
  static initClass() {
    this.prototype.statusBar = null;                 // The status bar.
    this.prototype.xpathLabel = null;                // StatusBar label for XPath.
    this.prototype.tile = null;                      // Tile object appended to the StatusBar.
    this.prototype.xpathSubscription = null;         // TextEditor content change subscription.
    this.prototype.activeItemSubscription = null;    // Active panel change subscription.
    this.prototype.configurationSubscription = null;
     // Configuration change subscription.
  }

  //# Constructor: create the label and append to the div.
  initialize(statusBar) {
    this.statusBar = statusBar;
    this.classList.add('xpath-status', 'inline-block');  // Class is inline-block.
    this.xpathLabel = document.createElement('label');   // Object will be label.
    this.appendChild(this.xpathLabel);                       // Append the label to div.
    this.handleEvents();
    return this;
  }

  //# Destroy all the components.
  destroy() {
    this.disposeViewSubscriptions();

    // Dispose the subscription to panel changes.
    if (this.activeItemSubscription != null) {
      this.activeItemSubscription.dispose();
    }
    this.activeItemSubscription = null;

    // Destroy the configuration change subscription.
    if (this.configurationSubscription != null) {
      this.configurationSubscription.dispose();
    }
    this.configurationSubscription = null;

    // Destroy the tile StatusBar object.
    if (this.tile != null) {
      this.tile.destroy();
    }
    return this.tile = null;
  }

  //# Subscribe to configuration chages and panel changes.
  handleEvents() {
    // Check for current panel active changes to attach listeners.
    this.activeItemSubscription = atom.workspace.onDidChangeActivePaneItem(() => {
      return this.subscribeToActiveTextEditor();
    });

    // Check for configuration changes.
    this.configurationSubscription = atom.config.observe(
      'autocomplete-xml-magento-edition.showXPathInStatusBar', () => this.attach());

    // And attach subscriber to the current panel if it's a TextEditor.
    return this.subscribeToActiveTextEditor();
  }

  //# Attach the view to the status bar.
  attach() {
    // Destroy the current StatusBar object.
    if (this.tile != null) {
      this.tile.destroy();
    }

    if (atom.config.get('autocomplete-xml-magento-edition.showXPathInStatusBar')) {
      // Append to the statusBar a new.
      this.tile = this.statusBar.addRightTile({item: this});
    } else {
      // Disable -> dispose everything if it was created previously.
      this.disposeViewSubscriptions();
    }
    return this.tile;
  }

  //# Dispose the subscription events of the view.
  disposeViewSubscriptions() {
    // Dispose the subscription to text editor changes.
    if (this.xpathSubscription != null) {
      this.xpathSubscription.dispose();
    }
    return this.xpathSubscription = null;
  }

  //# Helper method to get the current TextEditor if any.
  getActiveTextEditor() {
    return atom.workspace.getActiveTextEditor();
  }

  //# Subscribe the event ChangeCursor to update the XPath.
  subscribeToActiveTextEditor() {
    if (this.xpathSubscription != null) {
      this.xpathSubscription.dispose();
    }

    // Only if it's an XML file.
    if (__guard__(__guard__(this.getActiveTextEditor(), x1 => x1.getGrammar()), x => x.name) === "XML") {
      this.updateXPath();
      return this.xpathSubscription = __guard__(this.getActiveTextEditor(), x2 => x2.onDidChangeCursorPosition(() => {
        return this.updateXPath();
      }));
    } else {
      return this.xpathLabel.textContent = '';
    }
  }

  //# Update the content of the label with the current XPath if any.
  updateXPath() {
    const editor = this.getActiveTextEditor();
    if (editor) {
      const buffer = editor.getBuffer();
      const bufferPosition = editor.getCursorBufferPosition();
      const xpath = utils.getXPathCompleteWord(buffer, bufferPosition);
      return this.xpathLabel.textContent = xpath.join('/');
    } else {
      return this.xpathLabel.textCotent = '';
    }
  }
}
XPathStatusBarView.initClass();

//# Register the class into the document to be available.
module.exports =
  document.registerElement(
    'xpath-statusbar',
    {prototype: XPathStatusBarView.prototype});

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
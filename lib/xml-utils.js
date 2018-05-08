/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// This will catch:
// * Start tags: <tagName
// * End tags: </tagName
// * Auto close tags: />
const startTagPattern = '<\s*[\\.\\-:_a-zA-Z0-9]+';
const endTagPattern = '<\\/\s*[\\.\\-:_a-zA-Z0-9]+';
const autoClosePattern = '\\/>';
const startCommentPattern = '\s*<!--';
const endCommentPattern = '\s*-->';
const fullPattern = new RegExp("(" +
  startTagPattern + "|" + endTagPattern + "|" + autoClosePattern + "|" +
  startCommentPattern + "|" + endCommentPattern + ")", "g");
const wordPattern = new RegExp('^(\\w+)');


module.exports = {
  getXPathWithPrefix(buffer, bufferPosition, prefix, maxDepth) {
    let {row, column} = bufferPosition;
    column -= prefix.length;
    return this.getXPath(buffer, row, column, maxDepth);
  },


  getXPathCompleteWord(buffer, bufferPosition, maxDepth) {
    let {row, column} = bufferPosition;

    // Try to get the end of the current word if any
    const line = buffer.lineForRow(row).slice(column);
    const wordMatch = line.match(wordPattern);
    if (wordMatch) { column += wordMatch[1].length; }

    return this.getXPath(buffer, row, column, maxDepth);
  },


  getXPath(buffer, row, column, maxDepth) {
    // For every row, checks if it's an open, close, or autoopenclose tag and
    // update a list of all the open tags.
    const xpath = [];
    const skipList = [];
    let waitingStartTag = false;
    const waitingStarTComment = false;

    // For the first line read removing the prefix
    let line = buffer.getTextInRange([[row, 0], [row, column]]);

    while ((row >= 0) && (!maxDepth || (xpath.length < maxDepth))) {
      row--;

      // Apply the regex expression, read from right to left.
      const matches = line.match(fullPattern);
      if (matches != null) {
        matches.reverse();
      }

      for (let match of Array.from(matches != null ? matches : [])) {
        // Start comment
        var waitingStartComment;
        if (match === "<!--") {
          waitingStartComment = false;
        // End comment
        } else if (match === "-->") {
          waitingStartComment = true;
        // Ommit comment content
        } else if (waitingStartComment) {
          continue;
        // Auto tag close
        } else if (match === "/>") {
          waitingStartTag = true;
        // End tag
        } else if ((match[0] === "<") && (match[1] === "/")) {
          skipList.push(match.slice(2));
        // This should be a start tag
        } else if ((match[0] === "<") && waitingStartTag) {
          waitingStartTag = false;
        } else if (match[0] === "<") {
          const tagName = match.slice(1);

          // Ommit XML definition.
          if (tagName === "?xml") {
            continue;
          }

          const idx = skipList.lastIndexOf(tagName);
          if (idx !== -1) { skipList.splice(idx, 1); } else { xpath.push(tagName); }
        }
      }

      // Get next line
      line = buffer.lineForRow(row);
    }

    return xpath.reverse();
  }
};

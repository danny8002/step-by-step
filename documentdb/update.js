/**
 * update documents with continuation token. 
 * 
 * @param {Object} input 
 * @param {Object} options 
 */
function update(input, options) {

    var ctx = getContext();
    var col = ctx.getCollection();
    var link = col.getSelfLink();

    options = options || { 'continuation': null, 'nextRoundStart': 0, 'successCount': 0 };

    input = input || {};

    var result = {
        'continuation': options['continuation'],
        'nextRoundStart': options['nextRoundStart'],
        'successCount': options['successCount']
    };

    var pageSize = options.pageSize || 10;
    var query = "SELECT * FROM c";

    var func = {};

    func.startsWith = function (str, search, pos) {
        return (str || "").substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
    };

    func.update = function (doc) {

        // put your update logic in here
        // if return null, then no 'replaceDocument' operation happens

        return null;
    }


    func.setBody = function () {
        ctx.getResponse().setBody(result);
    }

    func.queryDocumentsCallBack = function (e, docs, responseOptions) {
        if (e) throw "Error when queryDocuments, number=" + e.number + ", message=" + e.body;

        var current = result['nextRoundStart'];
        var inner = {};

        inner.continueQuery = function () {

            if (responseOptions.continuation) {
                result['continuation'] = responseOptions.continuation;
                result['nextRoundStart'] = 0;

                // execute time out, return now
                if (!func.query({ 'pageSize': pageSize, 'continuation': responseOptions.continuation })) {
                    return func.setBody();
                }
            }
            else {
                // no data anymore, return response
                result['continuation'] = null;
                result['nextRoundStart'] = 0;
                return func.setBody();
            }
        }

        inner.updateCallback = function (e) {
            if (e) throw "Error when replaceDocument, number=" + e.number + ", message=" + e.body;
            result['successCount']++;

            // next
            ++current;
            if (current < docs.length) {
                inner.updateDoc(docs[current]);
            } else {
                inner.continueQuery();
            }
        }

        inner.updateDoc = function (doc) {

            var update = func.update(doc);

            if (update == null) {
                // no need to update
                // do next
                return inner.updateCallback(null);
            }

            var accept = col.replaceDocument(update._self, update, {}, inner.updateCallback);
            if (!accept) {
                result['nextRoundStart'] = current;
                return func.setBody();
            }
        }

        if (docs.length > 0) {
            inner.updateDoc(docs[current]);
        } else {
            inner.continueQuery();
        }
    }

    func.query = function (options) {

        return col.queryDocuments(link, query, options, func.queryDocumentsCallBack);
    }

    var accept = func.query({ 'pageSize': pageSize, 'continuation': result['continuation'] });
    if (!accept) throw "queryDocuments not accept";
}
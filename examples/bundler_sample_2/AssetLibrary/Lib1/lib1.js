
var lib1Helper = require( "./lib1_helper.js" );

module.exports.identify = function() {
	return "i am lib1.  i depend on my little helper: " + lib1Helper.identify();
};
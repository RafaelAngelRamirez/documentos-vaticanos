// Regex oficial de semver.org
// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const r =
  /(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?/gm;


module.exports.readVersion = function (contents) {
    let version_completa = contents.match(r).pop();
  return version_completa;
};

module.exports.writeVersion = function (contents, version) {
  return contents.replace(r, version);
};

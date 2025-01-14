const { depth } = require('treeverse')

const calcDepFlags = tree => {
  tree.dev = false
  tree.optional = false
  tree.devOptional = false
  return depth({
    tree,
    visit: node => calcDepFlagsStep(node),
    filter: node => node,
    getChildren: node => [...node.edgesOut.values()].map(edge => edge.to),
  })
}

const calcDepFlagsStep = (node) => {
  // This rewalk is necessary to handle cases where devDep and optional
  // or normal dependency graphs overlap deep in the dep graph.
  // Since we're only walking through deps that are not already flagged
  // as non-dev/non-optional, it's typically a very shallow traversal
  node.extraneous = false

  // for links, map their hierarchy appropriately
  // XXX: Maybe don't bother with this?  Treating links as no-ops
  // isn't the worst thing ever.  But it could be convenient to
  // be able to work on linked trees, especially in workspaces.
  if (node.target) {
    node.target.dev = node.dev
    node.target.optional = node.optional
    node.target.devOptional = node.devOptional
    node.target.extraneous = false
    node = node.target
  }

  node.edgesOut.forEach(({type, to}) => {
    // if the dep is missing, then its flags are already maximally unset
    if (!to)
      return

    // everything with any kind of edge into it is not extraneous
    to.extraneous = false

    // devOptional is the *overlap* of the dev and optional tree.
    // however, for convenience and to save an extra rewalk, we leave
    // it set when we are in *either* tree, and then omit it from the
    // package-lock if either dev or optional are set.
    const unsetDevOpt = !node.devOptional && !node.dev && !node.optional &&
      type !== 'dev' && type !== 'optional'

    // if we are not in the devOpt tree, then we're also not in
    // either the dev or opt trees
    const unsetDev = unsetDevOpt || !node.dev && type !== 'dev'
    const unsetOpt = unsetDevOpt || !node.optional && type !== 'optional'

    if (unsetDevOpt)
      unsetFlag(to, 'devOptional')

    if (unsetDev)
      unsetFlag(to, 'dev')

    if (unsetOpt)
      unsetFlag(to, 'optional')
  })

  return node
}

// typically a short walk, since it only traverses deps that
// have the flag set.
const unsetFlag = (node, flag) => {
  if (node[flag]) {
    depth({
      tree: node,
      visit: node => node[flag] = false,
      getChildren: node => [...node.edgesOut.values()]
        .filter(edge => edge.to && edge.to[flag] &&
          (edge.type === 'peer' || edge.type === 'prod'))
        .map(edge => edge.to),
    })
  }
}

module.exports = calcDepFlags

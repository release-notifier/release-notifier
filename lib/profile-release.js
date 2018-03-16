require('dotenv-safe').load()
require('make-promises-safe')

const assert = require('assert')
const {chain} = require('lodash')
const GitHub = require('@octokit/rest')
const semver = require('semver')

function tagNameToVersionNumber (tag) {
  return tag.replace(/^v/i, '')
}

module.exports = async function profileRelease (opts = {}) {
  assert(opts.owner, 'opts.owner is required')
  assert(opts.repo, 'opts.repo is required')
  assert(opts.tagName, 'opts.tagName is required')

  // initialize a new client if none was passed in (for testing purposes)
  if (!opts.github) {
    assert(process.env.GH_TOKEN, 'GH_TOKEN is required for testing')
    opts.github = GitHub()
    opts.github.authenticate({type: 'token', token: process.env.GH_TOKEN})
  }

  const {owner, repo, tagName, github} = opts

  const {data: releaseData} = await github.repos.getReleases({
    owner,
    repo,
    per_page: 30
  })

  const recentReleases = releaseData
    .map(release => {
      release.version = tagNameToVersionNumber(release.tag_name)
      return release
    })
    .filter(release => semver.valid(release.version))
    .sort((a, b) => semver.compare(b.version, a.version))

  const currentRelease = recentReleases
    .find(release => release.tag_name === tagName)

  const previousReleases = recentReleases
    .filter(release => !release.prerelease)
    .filter(release => semver.lt(release.version, currentRelease.version))

  if (!previousReleases.length) {
    throw new Error('no previous releases found with a lower semantic version')
  }

  const previousRelease = previousReleases[0]

  const {data: commits} = await github.repos.getCommits({
    owner,
    repo,
    sha: currentRelease.tag_name,
    since: previousRelease.created_at
  })

  // Create a nice title without redundant version info
  currentRelease.title = currentRelease.name.includes(currentRelease.version)
    ? currentRelease.name
    : `${currentRelease.tag_name}: ${currentRelease.name}`

  let pulls = []
  for (commit of commits) {
    const {data: {items: [pullRequest]}} = await github.search.issues({q: commit.sha})
    pulls.push(pullRequest)
  }
  pulls = chain(pulls).compact().uniqBy('number').value()

  return {
    currentRelease,
    previousRelease,
    commits,
    pulls
  }
}

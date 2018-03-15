const {chain} = require('lodash')
const semver = require('semver')

module.exports = (robot) => {
  robot.on('release.published', handleRelease.bind(null, robot))
}

async function handleRelease (robot, context) {
  const owner = context.payload.repository.owner.login
  const repo = context.payload.repository.name

  function log (message) {
    robot.log.debug('%s/%s: %s', owner, repo, message)
  }

  log(`${context.payload.release.tag_name} published!`)

  const {data: releaseData} = await context.github.repos.getReleases({
    owner,
    repo,
    per_page: 50
  })

  const recentReleases = releaseData
    .map(release => {
      release.version = tagNameToVersionNumber(release.tag_name)
      return release
    })
    .filter(release => semver.valid(release.version))
    .sort((a, b) => semver.compare(b.version, a.version))

  const currentRelease = recentReleases
    .find(release => release.tag_name === context.payload.release.tag_name)

  const previousReleases = recentReleases
    .filter(release => !release.prerelease)
    .filter(release => semver.lt(release.version, currentRelease.version))

  if (!previousReleases.length) {
    log('no previous releases found with a lower semantic version (aborting)')
    return
  }

  const previousRelease = previousReleases[0]

  log(`previous release was ${previousRelease.tag_name} (${previousRelease.created_at})`)

  const {data: commits} = await context.github.repos.getCommits({
    owner,
    repo,
    sha: currentRelease.tag_name,
    since: previousRelease.created_at
  })

  log(`commits between versions: ${commits.length}`)
  console.log(commits)

  // Create a nice title without redundant version info
  currentRelease.title = currentRelease.name.includes(currentRelease.version)
    ? currentRelease.name
    : `${currentRelease.tag_name}: ${currentRelease.name}`

  log(`release title: ${currentRelease.title}`)

  chain(commits)
    .map(async commit => {
      const {data: {items: [pullRequest]}} = await context.github.search.issues({q: commit.sha})
      return pullRequest
    })
    .compact()
    .uniqBy('number')
    .forEach(async pullRequest => {
      log(`pull request number: ${pullRequest.number}`)
      await context.github.issues.createComment({
        owner,
        repo,
        number: pullRequest.number,
        body: `This PR landed in [${currentRelease.title}](${currentRelease.html_url}) :tada:`
      })
    })
}

function tagNameToVersionNumber (tag) {
  return tag.replace(/^v/i, '')
}

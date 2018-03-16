const profileRelease = require('./lib/profile-release')

module.exports = (robot) => {
  robot.on('release.published', handleRelease.bind(null, robot))
}

async function handleRelease (robot, context) {
  const owner = context.payload.repository.owner.login
  const repo = context.payload.repository.name
  const tagName = context.payload.release.tag_name

  function log (message) {
    robot.log('%s/%s@%s: %s', owner, repo, tagName, message)
  }

  const profile = profileRelease({
    owner,
    repo,
    tagName,
    github: context.github
  }).catch(err => log(err))

  if (!profile) return

  const {currentRelease, pulls} = profile

  for (const pull of pulls) {
    await context.github.issues.createComment({
      owner,
      repo,
      number: pull.number,
      body: `This PR landed in [${currentRelease.title}](${currentRelease.html_url}) :tada:`
    })
  }
}

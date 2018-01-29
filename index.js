const {chain} = require('lodash')

module.exports = (robot) => {
  robot.log('hello from the robot')

  robot.on('release.published', handleRelease.bind(null, robot))
  robot.on('*', async context => {
    robot.log('hello! an event..')
    robot.log(Object.keys(context))
    // robot.log(context.payload)
  })
}

async function handleRelease (robot, context) {
  // console.log(context.payload)
  console.log(context.payload.release.body)
  
  const owner = context.payload.repository.owner.login
  const repo = context.payload.repository.name
  const {data: [latestRelease, previousRelease]} = await context.github.repos.getReleases({
    owner,
    repo,
    per_page: 2
  })

  // TODO: will break on repo with single release
  console.log(latestRelease.tag_name, previousRelease.tag_name)
  
  const {data: commits} = await context.github.repos.getCommits({
    owner,
    repo,
    sha: latestRelease.tag_name,
    since: previousRelease.created_at
  })
  
  console.log(commits.length)
    
  const pullRequests = chain(commits)
    .map(async commit => {
      const {data: {items: [pullRequest]}} = await context.github.search.issues({q: commit.sha})

      return pullRequest
    })
    .compact()
    .uniqBy('number')
    .forEach(async pullRequest => {
      await context.github.issues.createComment({
        owner,
        repo,
        number: (await pullRequest).number,
        body: `This PR landed in [${latestRelease.name}](${latestRelease.html_url})`
      })
    })
    .value()
}

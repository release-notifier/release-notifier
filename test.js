if (!process.env.CI) require('dotenv-safe').load()

const profileRelease = require('./lib/profile-release')

jest.setTimeout(60 * 1000)

describe('profileRelease', () => {
  test('is a function', () => {
    expect(typeof profileRelease).toBe('function')
  })

  test('builds a profile of the release', async () => {
    const profile = await profileRelease({
      owner: 'electron',
      repo: 'i18n',
      tagName: 'v1.19.0'
    })

    expect(profile).toHaveProperty('currentRelease')
    expect(profile).toHaveProperty('previousRelease')
    expect(profile).toHaveProperty('commits')
    expect(profile).toHaveProperty('pulls')

    expect(profile.currentRelease.tag_name).toEqual('v1.19.0')
    expect(profile.previousRelease.tag_name).toEqual('v1.18.0')
    expect(profile.commits).toHaveLength(2)
    expect(profile.pulls.length).toEqual(1)

    // check for props used in issue comment
    expect(profile.currentRelease.html_url).toBe('https://github.com/electron/i18n/releases/tag/v1.19.0')
    expect(profile.currentRelease.title).toEqual('v1.19.0')
  })

  xtest('creates a nice title for named releases', async () => {
    const profile = await profileRelease({
      owner: 'probot',
      repo: 'probot',
      tagName: 'v6.0.0'
    })
    expect(profile.currentRelease.title).toEqual('v6.0.0 – 2018-02-28')
  })

  test('throws an error if no previous releases exist', async () => {
    expect.assertions(1)
    await profileRelease({
      owner: 'release-notifier',
      repo: 'release-notifier',
      tagName: 'v1.0.0'
    }).catch(err => {
      expect(err.message).toBe('no previous releases found with a lower semantic version')
    })
  })
})

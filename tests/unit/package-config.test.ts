// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

interface PackageConfig {
  name: string
  productName: string
  version: string
  build: {
    appId: string
    files: string[]
    productName: string
    win: {
      icon: string
      target: Array<{ target: string; arch: string[] }>
    }
    nsis: {
      installerIcon: string
      uninstallerIcon: string
    }
  }
}

function readPackageConfig(): PackageConfig {
  return JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as PackageConfig
}

describe('desktop package configuration', () => {
  it('keeps the stable application identity', () => {
    const packageConfig = readPackageConfig()

    expect(packageConfig.name).toBe('wovennote')
    expect(packageConfig.productName).toBe('WovenNote')
    expect(packageConfig.version).toBe('0.1.7')
    expect(packageConfig.build.appId).toBe('com.yusufhasan.wovennote')
    expect(packageConfig.build.productName).toBe('WovenNote')
    expect(packageConfig.build.nsis.guid).toBe('92d0152d-4083-5d87-a86d-31fc787dcc3d')
  })

  it('targets a Windows x64 NSIS installer', () => {
    const build = readPackageConfig().build
    const [target] = build.win.target

    expect(target).toEqual({ target: 'nsis', arch: ['x64'] })
    expect(build.win.icon).toBe('build/icon.ico')
    expect(build.nsis.installerIcon).toBe('build/icon.ico')
    expect(build.nsis.uninstallerIcon).toBe('build/icon.ico')
    expect(build.files).toContain('build/icon.png')
  })
})

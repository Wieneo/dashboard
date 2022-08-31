//
// SPDX-FileCopyrightText: 2021 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

'use strict'

const { basename } = require('path')
const { helm } = fixtures

const renderTemplates = helm.renderTemplatesFn('gardener-dashboard', 'charts', basename(__dirname))

describe('gardener-dashboard', function () {
  describe('deployment', function () {
    let templates

    beforeEach(() => {
      templates = [
        'deployment'
      ]
    })

    it('should render the template with default values', async function () {
      const values = {}
      const documents = await renderTemplates(templates, values)
      expect(documents).toHaveLength(1)
      const [deployment] = documents
      expect(deployment).toMatchSnapshot({
        spec: {
          template: {
            metadata: {
              annotations: {
                'checksum/configmap-gardener-dashboard-config': expect.stringMatching(/[0-9a-f]{64}/),
                'checksum/secret-gardener-dashboard-oidc': expect.stringMatching(/[0-9a-f]{64}/),
                'checksum/secret-gardener-dashboard-sessionSecret': expect.stringMatching(/[0-9a-f]{64}/)
              }
            }
          }
        }
      })
    })

    it('should render the template with node options', async function () {
      const values = {
        global: {
          nodeOptions: ['--max-old-space-size=460', '--expose-gc', '--trace-gc', '--gc-interval=100']
        }
      }
      const documents = await renderTemplates(templates, values)
      expect(documents).toHaveLength(1)
      const [deployment] = documents
      const containers = deployment.spec.template.spec.containers
      expect(containers).toHaveLength(1)
      const [container] = containers
      expect(container.args).toMatchSnapshot()
    })

    it('should render the template with an empty list node options', async function () {
      const values = {
        global: {
          nodeOptions: []
        }
      }
      const documents = await renderTemplates(templates, values)
      expect(documents).toHaveLength(1)
      const [deployment] = documents
      const containers = deployment.spec.template.spec.containers
      expect(containers).toHaveLength(1)
      const [container] = containers
      expect(container.args).toBeUndefined()
    })

    it('should not project service account token if disabled', async function () {
      const values = {
        global: {
          serviceAccountTokenVolumeProjection: {
            enabled: false
          }
        }
      }
      const documents = await renderTemplates(templates, values)
      expect(documents).toHaveLength(1)
      const [deployment] = documents
      const volumes = deployment.spec.template.spec.volumes
      expect(volumes).toHaveLength(2)
      expect(volumes).toMatchSnapshot()
      const containers = deployment.spec.template.spec.containers
      expect(containers).toHaveLength(1)
      const [container] = containers
      expect(container.volumeMounts).toHaveLength(2)
      expect(container.volumeMounts).toMatchSnapshot()
    })

    describe('virtual garden', function () {
      it('should render the template', async function () {
        const values = {
          global: {
            virtualGarden: {
              enabled: true
            },
            serviceAccountTokenVolumeProjection: {
              enabled: true,
              expirationSeconds: 3600,
              audience: 'https://identity.garden.example.org'
            }
          }
        }
        const documents = await renderTemplates(templates, values)
        expect(documents).toHaveLength(1)
        const [deployment] = documents
        expect(deployment.spec.template.spec.serviceAccountName).toEqual('gardener-dashboard')
        const volumes = deployment.spec.template.spec.volumes
        expect(volumes).toHaveLength(3)
        const [, , serviceAccountTokenVolume] = volumes
        expect(serviceAccountTokenVolume).toMatchSnapshot()
        const containers = deployment.spec.template.spec.containers
        expect(containers).toHaveLength(1)
        const [container] = containers
        expect(container.volumeMounts).toHaveLength(3)
        const [, , serviceAccountTokenVolumeMount] = container.volumeMounts
        expect(serviceAccountTokenVolumeMount).toMatchSnapshot()
      })

      it('should use the default service account', async function () {
        const values = {
          global: {
            virtualGarden: {
              enabled: true
            },
            serviceAccountTokenVolumeProjection: {
              enabled: false
            }
          }
        }
        const documents = await renderTemplates(templates, values)
        expect(documents).toHaveLength(1)
        const [deployment] = documents
        expect(deployment.spec.template.spec.serviceAccountName).toEqual('default')
      })
    })
  })
})

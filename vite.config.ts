import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function liveGpsApi() {
  const locations = new Map()

  return {
    name: 'live-gps-api',
    configureServer(server) {
      server.middlewares.use('/api/live-gps', (req, res, next) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => {
            body += chunk
          })
          req.on('end', () => {
            try {
              const location = JSON.parse(body)
              locations.set(location.service, location)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid GPS payload' }))
            }
          })
          return
        }

        if (req.method === 'GET') {
          const service = req.url?.replace('/', '')
          const location = service ? locations.get(service) : null
          res.setHeader('Content-Type', 'application/json')
          if (!location) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'GPS location not available' }))
            return
          }
          res.end(JSON.stringify(location))
          return
        }

        next()
      })
    },
  }
}

function yoloApiPlaceholder() {
  return {
    name: 'yolo-api-placeholder',
    configureServer(server) {
      server.middlewares.use('/api/yolo', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        let body = ''
        req.on('data', chunk => {
          body += chunk
        })
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            detections: [],
            status: 'placeholder',
            message: 'Connect this endpoint to a YOLO inference server.'
          }))
        })
      })
    },
  }
}

function roboflowWorkflowApi(apiKey) {
  return {
    name: 'roboflow-workflow-api',
    configureServer(server) {
      server.middlewares.use('/api/roboflow', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        let body = ''
        req.on('data', chunk => {
          body += chunk
        })
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')

          if (!apiKey) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'ROBOFLOW_API_KEY is not configured' }))
            return
          }

          try {
            const payload = JSON.parse(body)
            const response = await fetch(
              'https://serverless.roboflow.com/aliefs-workspace-bemvh/workflows/emergency-severity-analyzer-1778770846609',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, api_key: apiKey }),
              },
            )
            res.statusCode = response.status
            res.end(await response.text())
          } catch {
            res.statusCode = 502
            res.end(JSON.stringify({ error: 'Unable to run Roboflow workflow' }))
          }
        })
      })
    },
  }
}

function roboflowWebrtcApi(apiKey) {
  return {
    name: 'roboflow-webrtc-api',
    configureServer(server) {
      server.middlewares.use('/api/roboflow-webrtc', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        let body = ''
        req.on('data', chunk => {
          body += chunk
        })
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')

          if (!apiKey) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'ROBOFLOW_API_KEY is not configured' }))
            return
          }

          try {
            const { offer, wrtcParams } = JSON.parse(body)
            const workflowConfiguration = {
              type: 'WorkflowConfiguration',
              image_input_name: wrtcParams.imageInputName ?? 'image',
              workspace_name: wrtcParams.workspaceName,
              workflow_id: wrtcParams.workflowId,
              workflows_parameters: wrtcParams.workflowsParameters ?? {},
              workflows_thread_pool_workers: wrtcParams.threadPoolWorkers ?? 4,
              cancel_thread_pool_tasks_on_exit: true,
              video_metadata_input_name: 'video_metadata',
            }
            const payload = {
              workflow_configuration: workflowConfiguration,
              api_key: apiKey,
              webrtc_realtime_processing: wrtcParams.realtimeProcessing ?? true,
              webrtc_offer: offer,
              webrtc_config: wrtcParams.iceServers?.length
                ? { iceServers: wrtcParams.iceServers }
                : null,
              stream_output: wrtcParams.streamOutputNames ?? [],
              data_output: wrtcParams.dataOutputNames ?? [],
              processing_timeout: wrtcParams.processingTimeout,
              requested_plan: wrtcParams.requestedPlan,
              requested_region: wrtcParams.requestedRegion,
              ...(wrtcParams.rtspUrl ? { rtsp_url: wrtcParams.rtspUrl } : {}),
            }
            const response = await fetch(
              'https://serverless.roboflow.com/initialise_webrtc_worker',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              },
            )
            res.statusCode = response.status
            res.end(await response.text())
          } catch {
            res.statusCode = 502
            res.end(JSON.stringify({ error: 'Unable to initialize Roboflow WebRTC workflow' }))
          }
        })
      })
    },
  }
}


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      liveGpsApi(),
      yoloApiPlaceholder(),
      roboflowWorkflowApi(env.ROBOFLOW_API_KEY),
      roboflowWebrtcApi(env.ROBOFLOW_API_KEY),
      figmaAssetResolver(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})

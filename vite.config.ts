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

function reverseGeocodeApi() {
  return {
    name: 'reverse-geocode-api',
    configureServer(server) {
      server.middlewares.use('/api/reverse-geocode', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const lat = url.searchParams.get('lat')
          const lng = url.searchParams.get('lng')
          if (!lat || !lng) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Latitude and longitude are required' }))
            return
          }
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'EmergencyConnect-ASEAN/1.0' } },
          )
          const result = await response.json()
          res.statusCode = response.status
          res.end(JSON.stringify({ address: result.display_name }))
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Unable to find address' }))
        }
      })
    },
  }
}

function routeApi() {
  return {
    name: 'route-api',
    configureServer(server) {
      server.middlewares.use('/api/route', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const fromLat = url.searchParams.get('fromLat')
          const fromLng = url.searchParams.get('fromLng')
          const toLat = url.searchParams.get('toLat')
          const toLng = url.searchParams.get('toLng')
          const apiKey = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')
            .VITE_TOMTOM_API_KEY
          if (![fromLat, fromLng, toLat, toLng].every(value => Number.isFinite(Number(value)))) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Valid origin and destination coordinates are required' }))
            return
          }
          if (apiKey) {
            const routeResponse = await fetch(
              `https://api.tomtom.com/routing/1/calculateRoute/${encodeURIComponent(fromLat)},${encodeURIComponent(fromLng)}:${encodeURIComponent(toLat)},${encodeURIComponent(toLng)}/json?traffic=true&routeRepresentation=polyline&computeTravelTimeFor=all&key=${apiKey}`,
            )
            const result = await routeResponse.json()
            const route = result.routes?.[0]
            if (route) {
              const points = route.legs?.[0]?.points ?? []
              res.end(JSON.stringify({
                distanceMeters: Number(route.summary?.lengthInMeters ?? 0),
                durationSeconds: Number(route.summary?.travelTimeInSeconds ?? 0),
                trafficDelaySeconds: Number(route.summary?.trafficDelayInSeconds ?? 0),
                trafficLevel: route.summary?.trafficDelayInSeconds > 300 ? 'severe' : route.summary?.trafficDelayInSeconds > 180 ? 'heavy' : route.summary?.trafficDelayInSeconds > 60 ? 'moderate' : 'light',
                coordinates: points.map((point: { longitude: number; latitude: number }) => [point.longitude, point.latitude]),
              }))
              return
            }
          }

          const routeResponse = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${encodeURIComponent(fromLng)},${encodeURIComponent(fromLat)};${encodeURIComponent(toLng)},${encodeURIComponent(toLat)}?overview=full&geometries=geojson`,
          )
          const result = await routeResponse.json()
          const route = result.routes?.[0]
          if (!route) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'Route not found' }))
            return
          }
          res.end(JSON.stringify({
            distanceMeters: route.distance,
            durationSeconds: route.duration,
            coordinates: route.geometry.coordinates,
          }))
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Unable to calculate route' }))
        }
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

function nlpApiPlaceholder(apiKey) {
  return {
    name: 'huggingface-nlp-api',
    configureServer(server) {
      server.middlewares.use('/api/nlp', (req, res, next) => {
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
            res.end(JSON.stringify({ available: false, classifications: [] }))
            return
          }
          try {
            const payload = JSON.parse(body)
            const hfResponse = await fetch('https://api-inference.huggingface.co/models/joeddav/xlm-roberta-large-xnli', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                inputs: payload.text,
                parameters: {
                  candidate_labels: [
                    'medical emergency',
                    'fire rescue emergency',
                    'police security emergency',
                    'natural disaster',
                    'lost property non emergency',
                    'threatening incident',
                    'dangerous animal threat',
                    'drug related crime',
                    'gas leak hazmat emergency',
                    'heart attack or stroke emergency',
                    'respiratory distress emergency',
                    'poisoning or chemical exposure emergency',
                  ],
                  multi_label: true,
                },
              }),
            })
            const result = await hfResponse.json()
            if (!hfResponse.ok) {
              res.end(JSON.stringify({ available: false, classifications: [], error: result.error ?? 'NLP unavailable' }))
              return
            }
            res.end(JSON.stringify({
              available: true,
              classifications: result.labels?.map((label, index) => ({
                label,
                score: Number(result.scores?.[index] ?? 0),
              })) ?? [],
            }))
          } catch {
            res.end(JSON.stringify({ available: false, classifications: [] }))
          }
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
            let payloadText = ''
            try {
              const payload = JSON.parse(body)
              payloadText = String(payload?.inputs?.report_text ?? '').toLowerCase()
            } catch {}
            const disasterType = /tsunami/.test(payloadText)
              ? 'tsunami'
              : /earthquake|gempa/.test(payloadText)
              ? 'earthquake'
              : /flood|banjir/.test(payloadText)
              ? 'flood'
              : /landslide|longsor/.test(payloadText)
              ? 'landslide'
              : /volcanic|gunung meletus|erupsi/.test(payloadText)
              ? 'volcanic eruption'
              : 'general emergency'
            res.statusCode = 200
            res.end(JSON.stringify({
              outputs: [{
                incident_type: disasterType,
                severity_score: 5,
                description: 'Roboflow is not configured in local preview; returning a neutral fallback response.',
                confidence: 0.25,
                predictions: []
              }]
            }))
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
      reverseGeocodeApi(),
      routeApi(),
      yoloApiPlaceholder(),
      nlpApiPlaceholder(env.HUGGINGFACE_API_KEY),
      roboflowWorkflowApi(env.ROBOFLOW_API_KEY),
      roboflowWebrtcApi(env.ROBOFLOW_API_KEY),
      figmaAssetResolver(),
      // React and Tailwind power the mobile prototype UI.
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})

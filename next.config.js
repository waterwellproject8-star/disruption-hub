/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['twilio', 'resend']
  },
  async redirects() {
    return [
      {
        source: '/demo',
        destination: '/demo.mp4',
        permanent: false,
      },
      {
        source: '/dashboard',
        destination: '/404',
        permanent: false,
      },
    ]
  }
}
module.exports = nextConfig

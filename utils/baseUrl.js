const baseUrl =
  process.env.NODE_ENV !== 'production'
    ? 'http://localhost:3000'
    : 'https://nextjs-social-media-flame.vercel.app'

export default baseUrl

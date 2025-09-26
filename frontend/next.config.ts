module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:5000/api/:path*'
          : 'https://chat-bot-pi-gray.vercel.app*', // Replace with your backend URL when deployed
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NODE_ENV === 'development'
      ? 'http://localhost:5000'
      : 'https://chat-bot-pi-gray.vercel.app', // Replace with your backend URL
  },
};
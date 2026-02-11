/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        // Warnings only, don't fail build
        ignoreDuringBuilds: true,
    },
};
module.exports = nextConfig;

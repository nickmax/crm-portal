/** @type {import('next').NextConfig} */
const nextConfig={
 trailingSlash:false,
 async rewrites(){return [{source:"/",has:[{type:"host",value:"ai.mathengeinc.com"}],destination:"/nia-ai-fellows"}];},
 async headers(){return [{source:"/:path*",headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},{key:"X-Frame-Options",value:"SAMEORIGIN"}]}];},
};
export default nextConfig;

FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY public ./public
COPY tsconfig.json .
COPY .prettierrc .
COPY .eslintrc.json .

# Build TypeScript
RUN npm run build

# Create upload directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Start web UI by default
CMD ["npm", "run", "web"]

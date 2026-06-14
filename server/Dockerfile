# Use Node LTS alpine image for a small footprint
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Expose port (default 5000)
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production

# Run the app
CMD ["node", "server.js"]
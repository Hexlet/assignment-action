setup:
	npm ci

install:
	npm install

build:
	npm run build

test:
	npx jest

lint:
	npx eslint .

run-test-api-server:
	npx fastify start server.js -l info -P

release:
	git push -f origin main:release

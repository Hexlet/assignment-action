setup:
	npm ci

install:
	npm install

build:
	npm run build

test:
	ACTIONS_STEP_DEBUG=true npx jest

lint:
	npx eslint .

release:
	git push -f origin main:release

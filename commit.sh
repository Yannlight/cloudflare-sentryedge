#!/bin/zsh
# commit.sh - Reset database_id, commit, and push all changes

# Reset database_id in worker/wrangler.toml
sed -i '' 's/^database_id = \".*\"/database_id = \"\"/' worker/wrangler.toml

git add .
git commit -am 'updated'
git push

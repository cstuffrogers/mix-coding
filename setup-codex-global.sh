 #!/bin/bash
 # 一键配置 Codex 全局 skills
 # 以管理员身份运行: bash setup-codex-global.sh

 set -e

 CODEX_SKILLS="$HOME/.codex/skills"
 PROJECT_SKILLS="E:/auto-coding/.agents/skills"
 LINK_NAME="auto-coding"

 echo "=== Codex 全局配置 ==="

 # 创建目标目录
 mkdir -p "$CODEX_SKILLS"

 # 创建符号链接
 if [ -L "$CODEX_SKILLS/$LINK_NAME" ]; then
     echo "符号链接已存在，跳过"
 else
     ln -s "$PROJECT_SKILLS" "$CODEX_SKILLS/$LINK_NAME"
     echo "✓ Skills 链接创建成功: $CODEX_SKILLS/$LINK_NAME -> $PROJECT_SKILLS"
 fi

 # 验证
 echo ""
 echo "已安装 skills:"
 ls -la "$CODEX_SKILLS/$LINK_NAME" | head -20

 echo ""
 echo "=== 配置完成 ==="
 echo "重启 Codex 后生效"
 #!/bin/bash
 # Setup Codex global skills
 # Run with: bash setup-codex-global.sh

 set -e

 CODEX_SKILLS="$HOME/.codex/skills"
 PROJECT_SKILLS="E:/auto-coding/.agents/skills"
 LINK_NAME="auto-coding"

 echo "=== Codex Global Setup ==="

 # Create target directory
 mkdir -p "$CODEX_SKILLS"

 # Create symbolic link
 if [ -L "$CODEX_SKILLS/$LINK_NAME" ]; then
     echo "Symlink already exists, skipping"
 else
     ln -s "$PROJECT_SKILLS" "$CODEX_SKILLS/$LINK_NAME"
     echo "SUCCESS: Skills link created"
 fi

 # Generate agents/openai.yaml for each skill
 echo ""
 echo "Generating agents/openai.yaml files..."

 # Main skills
 MAIN_SKILLS="ai-friendly-web-design awesome-design-md constitution-reference impeccable mobile-ui-review review-checklist sec-bug-hunt source-command-check source-command-mobile-review source-command-others source-command-plan-ceo-review source-command-qa source-command-recall speckit-agent-context-update speckit-analyze speckit-checklist speckit-clarify speckit-constitution speckit-converge speckit-implement speckit-plan speckit-specify speckit-tasks speckit-taskstoissues stack-knowledge web-design-engineer"

 for skill in $MAIN_SKILLS; do
     dir="$PROJECT_SKILLS/$skill/agents"
     yaml="$dir/openai.yaml"
     mkdir -p "$dir"
     if [ ! -f "$yaml" ]; then
         echo "skill: $skill" > "$yaml"
         echo "display_name: $skill" >> "$yaml"
         echo "short_description: Auto-coding skill" >> "$yaml"
         echo "default_prompt: Use the $skill skill to help with this task." >> "$yaml"
         echo "Created: $skill/agents/openai.yaml"
     fi
 done

 # MattPocock engineering skills
 ENG_SKILLS="diagnose grill-with-docs improve-codebase-architecture prototype setup-matt-pocock-skills tdd to-issues to-prd triage zoom-out"

 for skill in $ENG_SKILLS; do
     dir="$PROJECT_SKILLS/mattpocock/skills/skills/engineering/$skill/agents"
     yaml="$dir/openai.yaml"
     mkdir -p "$dir"
     if [ ! -f "$yaml" ]; then
         echo "skill: mattpocock-skills:$skill" > "$yaml"
         echo "display_name: $skill" >> "$yaml"
         echo "short_description: Matt Pocock engineering skill" >> "$yaml"
         echo "default_prompt: Use the $skill skill to help with this task." >> "$yaml"
         echo "Created: mattpocock/engineering/$skill/agents/openai.yaml"
     fi
 done

 # MattPocock productivity skills
 PROD_SKILLS="caveman grill-me handoff write-a-skill"

 for skill in $PROD_SKILLS; do
     dir="$PROJECT_SKILLS/mattpocock/skills/skills/productivity/$skill/agents"
     yaml="$dir/openai.yaml"
     mkdir -p "$dir"
     if [ ! -f "$yaml" ]; then
         echo "skill: mattpocock-skills:$skill" > "$yaml"
         echo "display_name: $skill" >> "$yaml"
         echo "short_description: Matt Pocock productivity skill" >> "$yaml"
         echo "default_prompt: Use the $skill skill to help with this task." >> "$yaml"
         echo "Created: mattpocock/productivity/$skill/agents/openai.yaml"
     fi
 done

 # MattPocock misc skills
 MISC_SKILLS="git-guardrails-claude-code migrate-to-shoehorn scaffold-exercises setup-pre-commit"

 for skill in $MISC_SKILLS; do
     dir="$PROJECT_SKILLS/mattpocock/skills/skills/misc/$skill/agents"
     yaml="$dir/openai.yaml"
     mkdir -p "$dir"
     if [ ! -f "$yaml" ]; then
         echo "skill: mattpocock-skills:$skill" > "$yaml"
         echo "display_name: $skill" >> "$yaml"
         echo "short_description: Matt Pocock misc skill" >> "$yaml"
         echo "default_prompt: Use the $skill skill to help with this task." >> "$yaml"
         echo "Created: mattpocock/misc/$skill/agents/openai.yaml"
     fi
 done

 # Verify
 echo ""
 echo "Installed skills:"
 ls -la "$CODEX_SKILLS/$LINK_NAME" | head -20

 echo ""
 echo "=== Setup Complete ==="
 echo "51 skills configured with agents/openai.yaml"
 echo "Restart Codex to apply changes."

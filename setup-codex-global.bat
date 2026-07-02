 @echo off
 REM Setup Codex global skills (Windows)
 REM Run as Administrator

 set CODEX_SKILLS=C:\Users\Administrator\.codex\skills
 set PROJECT_SKILLS=E:\auto-coding\.agents\skills
 set LINK_NAME=auto-coding

 echo === Codex Global Setup ===

 REM Create target directory
 if not exist "%CODEX_SKILLS%" mkdir "%CODEX_SKILLS%"

 REM Create symbolic link (requires Admin)
 if exist "%CODEX_SKILLS%\%LINK_NAME%" (
     echo Symlink already exists, skipping
 ) else (
     mklink /D "%CODEX_SKILLS%\%LINK_NAME%" "%PROJECT_SKILLS%"
     if errorlevel 1 (
         echo ERROR: Failed to create symlink. Run as Administrator.
         pause
         exit /b 1
     )
     echo SUCCESS: Skills link created
 )

 REM Generate agents/openai.yaml for each skill
 echo.
 echo Generating agents/openai.yaml files...

 REM Scene Runner (core workflow skill)
 if exist "%PROJECT_SKILLS%\scene-runner\SKILL.md" (
     if not exist "%PROJECT_SKILLS%\scene-runner\agents" mkdir "%PROJECT_SKILLS%\scene-runner\agents"
     echo skill: scene-runner > "%PROJECT_SKILLS%\scene-runner\agents\openai.yaml"
     echo display_name: Scene Runner >> "%PROJECT_SKILLS%\scene-runner\agents\openai.yaml"
     echo short_description: Execute Mix-Coding workflows (/audit, /review, /feature, etc.) >> "%PROJECT_SKILLS%\scene-runner\agents\openai.yaml"
     echo default_prompt: Use scene-runner to execute workflow commands like /audit or /review. >> "%PROJECT_SKILLS%\scene-runner\agents\openai.yaml"
     echo Created: scene-runner/agents/openai.yaml
 )

 REM Main skills
 for %%s in (ai-friendly-web-design awesome-design-md constitution-reference impeccable mobile-ui-review review-checklist sec-bug-hunt source-command-check source-command-mobile-review source-command-others source-command-plan-ceo-review source-command-qa source-command-recall speckit-agent-context-update speckit-analyze speckit-checklist speckit-clarify speckit-constitution speckit-converge speckit-implement speckit-plan speckit-specify speckit-tasks speckit-taskstoissues stack-knowledge web-design-engineer) do (
     if exist "%PROJECT_SKILLS%\%%s\SKILL.md" (
         if not exist "%PROJECT_SKILLS%\%%s\agents" mkdir "%PROJECT_SKILLS%\%%s\agents"
         if not exist "%PROJECT_SKILLS%\%%s\agents\openai.yaml" (
             echo skill: %%s > "%PROJECT_SKILLS%\%%s\agents\openai.yaml"
             echo display_name: %%s >> "%PROJECT_SKILLS%\%%s\agents\openai.yaml"
             echo short_description: Auto-coding skill >> "%PROJECT_SKILLS%\%%s\agents\openai.yaml"
             echo default_prompt: Use the %%s skill to help with this task. >> "%PROJECT_SKILLS%\%%s\agents\openai.yaml"
             echo Created: %%s/agents/openai.yaml
         )
     )
 )

 REM Count total skills
 set COUNT=0
 for /d %%d in ("%PROJECT_SKILLS%\*") do (
     if exist "%%d\SKILL.md" set /a COUNT+=1
 )

 echo.
 echo === Setup Complete ===
 echo %COUNT% skills configured
 echo Key skill: scene-runner (workflows: /audit, /review, /feature, etc.)
 echo Restart Codex to apply changes.
 pause

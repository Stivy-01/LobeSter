export class WrapperSnippets {
  build(generatedConfigPath: string) {
    return {
      bash: {
        title: "Bash/Zsh",
        snippet: `export OPENCLAW_CONFIG_PATH="${generatedConfigPath}"`,
      },
      powershell: {
        title: "PowerShell",
        snippet: `$env:OPENCLAW_CONFIG_PATH="${generatedConfigPath}"`,
      },
      dotenv: {
        title: ".env",
        snippet: `OPENCLAW_CONFIG_PATH=${generatedConfigPath}`,
      },
      docker: {
        title: "Docker Run Flag",
        snippet: `-e OPENCLAW_CONFIG_PATH=${generatedConfigPath}`,
      },
    } as const;
  }
}

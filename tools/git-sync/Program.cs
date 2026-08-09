using System.Diagnostics;
using System.Drawing;

namespace MwGatewayGitSync;

internal static class AppInfo
{
    public const string WindowTitle = "Gateway Git Sync";
    public const string ProjectName = "MW-Gateway-Manager";
    public const string RepoUrl = "https://github.com/lukather0329/MW-Gateway-Manager";
}

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var repository = RepositoryLocator.Find(args.FirstOrDefault());
        if (repository is null)
        {
            using var dialog = new FolderBrowserDialog
            {
                Description = "Git 저장소 폴더를 선택하세요.",
                UseDescriptionForTitle = true,
            };
            if (dialog.ShowDialog() != DialogResult.OK ||
                !Directory.Exists(Path.Combine(dialog.SelectedPath, ".git")))
            {
                MessageBox.Show(
                    "Git 저장소를 찾지 못했습니다.",
                    AppInfo.WindowTitle,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }
            repository = dialog.SelectedPath;
        }

        Application.Run(new SyncForm(repository));
    }
}

internal static class RepositoryLocator
{
    public static string? Find(string? requestedPath)
    {
        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(requestedPath))
        {
            candidates.Add(requestedPath);
        }

        candidates.Add(Environment.CurrentDirectory);
        candidates.Add(AppContext.BaseDirectory);

        var baseDirectoryParent = Directory.GetParent(AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar));
        if (baseDirectoryParent is not null)
        {
            candidates.Add(baseDirectoryParent.FullName);
        }

        foreach (var start in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var match = FindRepositoryFrom(start);
            if (match is not null)
            {
                return match;
            }
        }

        return null;
    }

    private static string? FindRepositoryFrom(string start)
    {
        var directory = new DirectoryInfo(Path.GetFullPath(start));
        while (directory is not null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, ".git")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        return null;
    }
}

internal sealed record GitResult(int ExitCode, string Output)
{
    public bool Success => ExitCode == 0;
}

internal static class GitRunner
{
    public static async Task<GitResult> Run(
        string repository,
        params string[] arguments)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "git.exe",
                WorkingDirectory = repository,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = System.Text.Encoding.UTF8,
                StandardErrorEncoding = System.Text.Encoding.UTF8,
            },
        };
        foreach (var argument in arguments)
        {
            process.StartInfo.ArgumentList.Add(argument);
        }

        process.Start();
        var standardOutput = process.StandardOutput.ReadToEndAsync();
        var standardError = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        var output = string.Join(
            Environment.NewLine,
            new[] { await standardOutput, await standardError }
                .Where(value => !string.IsNullOrWhiteSpace(value)))
            .Trim();
        return new GitResult(
            process.ExitCode,
            output
                .Replace("\r\n", "\n", StringComparison.Ordinal)
                .Replace("\r", "\n", StringComparison.Ordinal)
                .Replace("\n", Environment.NewLine, StringComparison.Ordinal));
    }
}

internal sealed class SyncForm : Form
{
    private readonly string repository;
    private readonly Label branchLabel = new();
    private readonly TextBox changesBox = new();
    private readonly TextBox messageBox = new();
    private readonly TextBox resultBox = new();
    private readonly Button refreshButton = new();
    private readonly Button pullButton = new();
    private readonly Button commitPushButton = new();
    private readonly Button pushButton = new();
    private readonly Button githubButton = new();
    private readonly List<Button> actionButtons;

    public SyncForm(string repository)
    {
        this.repository = repository;
        actionButtons =
            [refreshButton, pullButton, commitPushButton, pushButton, githubButton];
        ConfigureWindow();
        BuildLayout();
        Shown += async (_, _) => await RefreshStatus();
    }

    private void ConfigureWindow()
    {
        Text = AppInfo.WindowTitle;
        Width = 900;
        Height = 700;
        MinimumSize = new Size(760, 600);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(10, 12, 16);
        ForeColor = Color.WhiteSmoke;
        Font = new Font("Segoe UI", 10);
    }

    private void BuildLayout()
    {
        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(24),
            ColumnCount = 1,
            RowCount = 8,
        };
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 45));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 55));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));

        var title = new Label
        {
            Text = $"{AppInfo.ProjectName} Git 동기화",
            AutoSize = true,
            Font = new Font("Segoe UI", 20, FontStyle.Bold),
            Margin = new Padding(0, 0, 0, 6),
        };
        branchLabel.AutoSize = true;
        branchLabel.ForeColor = Color.FromArgb(232, 83, 26);
        branchLabel.Margin = new Padding(0, 0, 0, 14);

        ConfigureOutput(changesBox);
        ConfigureOutput(resultBox);
        changesBox.Text = "변경 파일을 확인하는 중입니다.";
        resultBox.Text = "작업 결과가 여기에 표시됩니다.";

        var commitLabel = new Label
        {
            Text = "커밋 메시지",
            AutoSize = true,
            Margin = new Padding(0, 12, 0, 5),
        };
        messageBox.Dock = DockStyle.Top;
        messageBox.PlaceholderText = "예: Apache 적용 로직 수정";
        messageBox.BackColor = Color.FromArgb(32, 36, 43);
        messageBox.ForeColor = Color.WhiteSmoke;
        messageBox.BorderStyle = BorderStyle.FixedSingle;

        var buttons = new FlowLayoutPanel
        {
            AutoSize = true,
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            Margin = new Padding(0, 14, 0, 14),
        };
        ConfigureButton(refreshButton, "새로고침", async () => await RefreshStatus());
        ConfigureButton(pullButton, "Pull", Pull);
        ConfigureButton(
            commitPushButton,
            "Commit & Push",
            CommitAndPush,
            primary: true);
        ConfigureButton(pushButton, "Push", Push);
        ConfigureButton(githubButton, "GitHub 열기", OpenGitHub);
        buttons.Controls.AddRange(
            [refreshButton, pullButton, commitPushButton, pushButton, githubButton]);

        var resultLabel = new Label
        {
            Text = "작업 결과",
            AutoSize = true,
            Margin = new Padding(0, 0, 0, 5),
        };
        var safety = new Label
        {
            Text = "Pull은 fast-forward만 허용합니다. 강제 Push나 자동 충돌 해결은 수행하지 않습니다.",
            AutoSize = true,
            ForeColor = Color.FromArgb(160, 166, 178),
            Margin = new Padding(0, 10, 0, 0),
        };

        root.Controls.Add(title);
        root.Controls.Add(branchLabel);
        root.Controls.Add(changesBox);
        root.Controls.Add(commitLabel);
        root.Controls.Add(messageBox);
        root.Controls.Add(buttons);
        root.Controls.Add(resultLabel);
        root.Controls.Add(resultBox);
        root.Controls.Add(safety);
        Controls.Add(root);
    }

    private static void ConfigureOutput(TextBox box)
    {
        box.Multiline = true;
        box.ReadOnly = true;
        box.ScrollBars = ScrollBars.Both;
        box.Dock = DockStyle.Fill;
        box.BackColor = Color.FromArgb(20, 23, 29);
        box.ForeColor = Color.FromArgb(224, 228, 235);
        box.BorderStyle = BorderStyle.FixedSingle;
        box.Font = new Font("Consolas", 9.5f);
        box.WordWrap = false;
    }

    private static void ConfigureButton(
        Button button,
        string text,
        Func<Task> action,
        bool primary = false)
    {
        button.Text = text;
        button.UseMnemonic = false;
        button.AutoSize = true;
        button.Padding = new Padding(12, 7, 12, 7);
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderSize = primary ? 0 : 1;
        button.BackColor = primary
            ? Color.FromArgb(232, 83, 26)
            : Color.FromArgb(32, 36, 43);
        button.ForeColor = Color.White;
        button.Click += async (_, _) => await action();
    }

    private async Task RefreshStatus()
    {
        await RunBusy(async () =>
        {
            var branch = await GitRunner.Run(
                repository,
                "branch",
                "--show-current");
            var status = await GitRunner.Run(
                repository,
                "status",
                "--short",
                "--branch");
            branchLabel.Text =
                $"저장소: {repository}    브랜치: {branch.Output.Trim()}";
            changesBox.Text = string.IsNullOrWhiteSpace(status.Output)
                ? "변경 파일이 없습니다."
                : status.Output;
        });
    }

    private async Task Pull()
    {
        await RunBusy(async () =>
        {
            var changes = await GitRunner.Run(repository, "status", "--porcelain");
            if (!string.IsNullOrWhiteSpace(changes.Output))
            {
                ShowResult(
                    "Pull 중단",
                    "로컬 변경 파일이 있습니다. 먼저 Commit & Push 하거나 정리해주세요.",
                    false);
                return;
            }
            ShowResult("Pull", await GitRunner.Run(repository, "pull", "--ff-only"));
            await RefreshStatus();
        });
    }

    private async Task CommitAndPush()
    {
        var message = messageBox.Text.Trim();
        if (message.Length < 2)
        {
            MessageBox.Show(
                "두 글자 이상의 커밋 메시지를 입력하세요.",
                AppInfo.WindowTitle,
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return;
        }

        await RunBusy(async () =>
        {
            var add = await GitRunner.Run(repository, "add", "--all");
            if (!add.Success)
            {
                ShowResult("Stage 실패", add);
                return;
            }
            var staged = await GitRunner.Run(
                repository,
                "diff",
                "--cached",
                "--quiet");
            if (staged.ExitCode == 0)
            {
                ShowResult("Commit 중단", "커밋할 변경 파일이 없습니다.", false);
                return;
            }
            if (staged.ExitCode != 1)
            {
                ShowResult("변경 확인 실패", staged);
                return;
            }
            var commit = await GitRunner.Run(repository, "commit", "-m", message);
            if (!commit.Success)
            {
                ShowResult("Commit 실패", commit);
                return;
            }
            var push = await GitRunner.Run(repository, "push");
            ShowResult(
                push.Success ? "Commit & Push 완료" : "Commit 완료 / Push 실패",
                $"{commit.Output}{Environment.NewLine}{push.Output}",
                push.Success);
            if (push.Success)
            {
                messageBox.Clear();
            }
            await RefreshStatus();
        });
    }

    private async Task Push()
    {
        await RunBusy(async () =>
        {
            ShowResult("Push", await GitRunner.Run(repository, "push"));
            await RefreshStatus();
        });
    }

    private async Task OpenGitHub()
    {
        await RunBusy(async () =>
        {
            var remote = await GitRunner.Run(repository, "remote", "get-url", "origin");
            if (!remote.Success || string.IsNullOrWhiteSpace(remote.Output))
            {
                ShowResult(
                    "GitHub 열기 실패",
                    "원격 저장소(origin)가 아직 설정되어 있지 않습니다. 'git remote add origin <URL>'로 먼저 등록해주세요.",
                    false);
                return;
            }

            var url = NormalizeRemoteUrl(remote.Output.Trim());
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            ShowResult("GitHub 열기", url, true);
        });
    }

    private static string NormalizeRemoteUrl(string url)
    {
        if (url.StartsWith("git@github.com:", StringComparison.Ordinal))
        {
            url = "https://github.com/" + url["git@github.com:".Length..];
        }

        if (url.EndsWith(".git", StringComparison.Ordinal))
        {
            url = url[..^".git".Length];
        }

        return url;
    }

    private async Task RunBusy(Func<Task> action)
    {
        SetBusy(true);
        try
        {
            await action();
        }
        catch (Exception error)
        {
            ShowResult("실행 오류", error.Message, false);
        }
        finally
        {
            SetBusy(false);
        }
    }

    private void SetBusy(bool busy)
    {
        foreach (var button in actionButtons)
        {
            button.Enabled = !busy;
        }
        UseWaitCursor = busy;
    }

    private void ShowResult(string title, GitResult result)
    {
        ShowResult(title, result.Output, result.Success);
    }

    private void ShowResult(string title, string output, bool success)
    {
        resultBox.Text =
            $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {title}{Environment.NewLine}" +
            (string.IsNullOrWhiteSpace(output) ? "완료" : output);
        resultBox.ForeColor = success
            ? Color.FromArgb(134, 239, 172)
            : Color.FromArgb(253, 164, 175);
    }
}

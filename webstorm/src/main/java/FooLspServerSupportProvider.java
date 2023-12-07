import com.intellij.openapi.project.Project;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.platform.lsp.api.LspServerSupportProvider;

import org.jetbrains.annotations.NotNull;


class FooLspServerSupportProvider implements LspServerSupportProvider {

    public void fileOpened(Project project, VirtualFile file, LspServerStarter serverStarter) {
        if (file.getExtension().equals("ocli")) {
            serverStarter.ensureServerStarted(new FooLspServerDescriptor(project));
        }
    }
}
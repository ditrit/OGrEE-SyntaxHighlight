import com.intellij.execution.configurations.GeneralCommandLine;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor;
import com.intellij.openapi.project.Project;
import org.jetbrains.annotations.NotNull;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URISyntaxException;
import java.net.URL;
import java.net.URLClassLoader;
import java.security.CodeSource;
import java.security.ProtectionDomain;
import java.util.Enumeration;

public class FooLspServerDescriptor extends ProjectWideLspServerDescriptor {

    public FooLspServerDescriptor(@NotNull Project project) {
        super(project, "TA RACE");
    }

    public boolean isSupportedFile(VirtualFile file) {
        return file.getExtension().equals("ocli");
    }
    public GeneralCommandLine createCommandLine() {
        // Get the URL of the currently executing JAR file
        Enumeration<URL> prote = null;
        try {
            prote = FooLspServerDescriptor.class.getProtectionDomain().getClassLoader().getResources(`""`);
            System.out.println(prote.hasMoreElements());
            while (prote.hasMoreElements()) {
                URL element = prote.nextElement();
                System.out.println(element);
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        System.out.println(prote);

        // test
        System.out.println(System.getProperty("user.dir"));
        String relativePath = "lsp/server.js";

        // Get the class loader associated with the current class
        ClassLoader classLoader = FooLspServerDescriptor.class.getClassLoader();

        // Load the resource using the class loader
        InputStream inputStream = classLoader.getResourceAsStream(relativePath);

        if (inputStream != null) {
            System.out.println("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        } else {
            // Resource not found
            System.err.println("Resource not found: " + relativePath);
        }

        return new GeneralCommandLine("node", "C:\\Users\\coren\\Documents\\IMT Atlantique\\S3\\Projet Entreprise\\Github Repository\\OGrEE-SyntaxHighlight\\server\\out\\server.js", "--stdio");

    }
}


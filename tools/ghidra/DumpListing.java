import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.*;
import java.io.*;

public class DumpListing extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        PrintWriter out = new PrintWriter(new BufferedWriter(new FileWriter(args[0])));
        InstructionIterator it = currentProgram.getListing().getInstructions(true);
        int n = 0;
        while (it.hasNext()) {
            Instruction i = it.next();
            out.println(i.getAddress() + "  " + i.toString());
            n++;
        }
        out.close();
        println("dumped " + n + " instructions to " + args[0]);
    }
}

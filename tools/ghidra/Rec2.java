import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import java.io.*;
import java.util.*;

public class Rec2 extends GhidraScript {
    public void run() throws Exception {
        String[] args = getScriptArgs();
        PrintWriter out = new PrintWriter(new BufferedWriter(new FileWriter(args[0])));
        long base = Long.decode(args[1]);
        int len = Integer.decode(args[2]);
        Program p = currentProgram;
        Listing listing = p.getListing();
        Address min = p.getMinAddress();
        Address max = p.getMaxAddress();
        AddressSet code = new AddressSet();
        ArrayDeque<Address> work = new ArrayDeque<>();
        for (int k = 3; k < args.length; k++) work.add(min.getNewAddress(Long.decode(args[k])));
        while (!work.isEmpty()) {
            Address a = work.pop();
            while (a != null && a.compareTo(max) <= 0 && !code.contains(a)) {
                if (!disassemble(a)) break;
                Instruction i = listing.getInstructionAt(a);
                if (i == null) break;
                code.add(a);
                for (Address t : i.getFlows()) if (t != null) work.add(t);
                String s0 = i.toString();
                String m = s0.trim().split("\\s+")[0].toUpperCase();
                if (m.equals("RET") || m.equals("RETI") || m.equals("RETN") || (m.startsWith("JP") && s0.contains("(HL)"))) a = null;
                else a = i.getFallThrough();
            }
        }
        byte[] mem = new byte[len];
        p.getMemory().getBytes(min, mem);
        for (long off = 0; off < len; off++) {
            Address a = min.getNewAddress(base + off);
            Instruction i = listing.getInstructionAt(a);
            if (i != null && code.contains(a)) {
                StringBuilder b = new StringBuilder();
                for (byte bb : i.getBytes()) b.append(String.format("%02x ", bb));
                out.printf("%04x  %-12s %s%n", base + off, b.toString(), i.toString());
            } else {
                out.printf("%04x  %02x           DEFB 0x%02x      ; data%n", base + off, mem[(int)off], mem[(int)off]);
            }
        }
        out.close();
        println("done");
    }
}

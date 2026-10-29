import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import java.io.*;
import java.util.*;

public class RecursiveDisasm extends GhidraScript {
    public void run() throws Exception {
        Program p = currentProgram;
        Listing listing = p.getListing();
        Address min = p.getMinAddress();
        Address max = p.getMaxAddress();
        AddressSet code = new AddressSet();
        ArrayDeque<Address> work = new ArrayDeque<>();
        long[] seeds = {0x0000,0x0008,0x0010,0x0018,0x0020,0x0028,0x0030,0x0038,0x0066};
        for (long s : seeds) work.add(min.getNewAddress(s));
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
                if (m.equals("RET") || m.equals("RETI") || m.equals("RETN") || m.startsWith("JP") && s0.contains("(HL)")) { a = null; }
                else a = i.getFallThrough();
            }
        }
        PrintWriter out = new PrintWriter(new BufferedWriter(new FileWriter(getScriptArgs()[0])));
        byte[] mem = new byte[0x2000];
        p.getMemory().getBytes(min, mem);
        for (long addr = 0; addr < 0x2000; addr++) {
            Address a = min.getNewAddress(addr);
            Instruction i = listing.getInstructionAt(a);
            if (i != null && code.contains(a)) {
                StringBuilder b = new StringBuilder();
                for (byte bb : i.getBytes()) b.append(String.format("%02x ", bb));
                out.printf("%04x  %-12s %s%n", addr, b.toString(), i.toString());
            } else {
                out.printf("%04x  %02x           DEFB 0x%02x      ; data%n", addr, mem[(int)addr], mem[(int)addr]);
            }
        }
        out.close();
        println("done");
    }
}

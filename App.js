// App.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";

// --- Banco de dados simulado ---
const fakeDB = {
  vars: [],
  insert(v) {
    v.id = this.vars.length ? this.vars[this.vars.length - 1].id + 1 : 1;
    this.vars.push(v);
  },
  update(id, updated) {
    const i = this.vars.findIndex((x) => x.id === id);
    if (i >= 0) this.vars[i] = { id, ...updated };
  },
  delete(id) {
    this.vars = this.vars.filter((x) => x.id !== id);
  },
  all() {
    return this.vars;
  },
};

// --- Substituição de variáveis ---
function substitute(expr, vars) {
  let out = expr;
  let replaced = true;
  let safety = 0;
  while (replaced && safety < 20) {
    replaced = false;
    vars.forEach((v) => {
      const regex = new RegExp(`\\b${v.name}\\b`, "g");
      if (regex.test(out)) {
        out = out.replace(regex, `(${v.value})`);
        replaced = true;
      }
    });
    safety++;
  }
  return out;
}

// --- Avaliador seguro ---
function evaluateExpression(txt, vars, final = false) {
  try {
    if (!txt || !txt.trim()) return final ? "Error" : "";

    let expr = substitute(txt, vars).replace(/\s+/g, "");

    // Substituições para operadores e funções
    expr = expr
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/\^/g, "**")
      .replace(/sqrt\(/g, "Math.sqrt("); // reconhece sqrt(

    // Expressões incompletas não avaliam até apertar "="
    const trailingIncomplete =
      /[+\-*\/\^]$/.test(expr) ||
      /Math\.sqrt\($/.test(expr) ||
      /sqrt\($/.test(expr);
    if (trailingIncomplete && !final) return "";

    const open = (expr.match(/\(/g) || []).length;
    const close = (expr.match(/\)/g) || []).length;
    if (open > close && !final) return "";

    // eslint-disable-next-line no-eval
    const val = eval(expr);
    if (!isFinite(val) || isNaN(val)) return final ? "Error" : "";
    return String(val);
  } catch {
    return final ? "Error" : "";
  }
}

// --- Gerenciador de variáveis ---
function VariableManager({ onChange }) {
  const [vars, setVars] = useState(fakeDB.all());
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(null);

  const refresh = () => {
    const all = [...fakeDB.all()];
    setVars(all);
    onChange(all);
  };

  const save = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a variable name.");
      return;
    }
    const obj = { name: name.trim(), value: value.trim() || "0" };
    if (editing) fakeDB.update(editing.id, obj);
    else fakeDB.insert(obj);
    setName("");
    setValue("");
    setEditing(null);
    refresh();
  };

  const edit = (v) => {
    setEditing(v);
    setName(v.name);
    setValue(v.value);
  };

  const del = (id) => {
    Alert.alert("Confirmation", "Delete variable?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          fakeDB.delete(id);
          refresh();
        },
      },
    ]);
  };

  return (
    <View style={styles.drawer}>
      <Text style={styles.drawerTitle}>Variables</Text>

      <TextInput
        placeholder="Name (e.g. a)"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        placeholder="Formula or value (e.g. 5, b+2, sqrt(9))"
        style={styles.input}
        value={value}
        onChangeText={setValue}
      />

      <TouchableOpacity style={styles.primaryButton} onPress={save}>
        <Text style={styles.primaryButtonText}>
          {editing ? "Save Changes" : "Create Variable"}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={vars}
        keyExtractor={(i) => i.id.toString()}
        style={{ marginTop: 10 }}
        renderItem={({ item }) => (
          <View style={styles.varRow}>
            <Text style={{ fontSize: 16 }}>
              {item.name} = {item.value}
            </Text>
            <View style={{ flexDirection: "row" }}>
              <TouchableOpacity onPress={() => edit(item)} style={{ marginRight: 10 }}>
                <Text>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => del(item.id)}>
                <Text>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

// --- Aplicativo principal ---
export default function App() {
  const [vars, setVars] = useState([]);
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const exprRef = useRef("");

  useEffect(() => {
    setVars([...fakeDB.all()]);
  }, []);

  const press = (key) => {
    if (key === "C") {
      setExpr("");
      setResult("");
      exprRef.current = "";
      return;
    }

    if (key === "DEL") {
      const newE = expr.slice(0, -1);
      setExpr(newE);
      exprRef.current = newE;
      setResult(evaluateExpression(newE, vars, false));
      return;
    }

    if (key === "=") {
      const val = evaluateExpression(expr, vars, true);
      if (val !== "Error" && val !== "") {
        setExpr(val);
        setResult("");
        exprRef.current = val;
      } else {
        setResult("Error");
      }
      return;
    }

    // Substitui o botão √ por "sqrt("
    const newE = expr + (key === "√" ? "sqrt(" : key);
    setExpr(newE);
    exprRef.current = newE;
    setResult(evaluateExpression(newE, vars, false));
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: 40 }}>
      {/* Cabeçalho */}
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={() => setDrawerOpen(!drawerOpen)}
          style={styles.menuBtn}
        >
          <Text style={{ fontSize: 22 }}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ProgCalc</Text>
      </View>

      {/* Drawer de variáveis */}
      {drawerOpen && (
        <View style={styles.drawerContainer}>
          <VariableManager
            onChange={(newVars) => {
              setVars(newVars);
              setResult(evaluateExpression(exprRef.current, newVars, false));
            }}
          />
        </View>
      )}

      {/* Display */}
      <View style={styles.display}>
        <TextInput
          style={styles.exprInput}
          value={expr}
          onChangeText={(t) => {
            setExpr(t);
            exprRef.current = t;
            setResult(evaluateExpression(t, vars, false));
          }}
          placeholder="Type your formula..."
        />
        <Text style={styles.resultText}>{result}</Text>
      </View>

      {/* Teclado */}
      <View style={styles.keypad}>
        {[
          ["C", "(", ")", "DEL"],
          ["7", "8", "9", "÷"],
          ["4", "5", "6", "×"],
          ["1", "2", "3", "-"],
          [".", "0", "^", "+"],
          ["√", "="],
        ].map((row, i) => (
          <View style={styles.row} key={i}>
            {row.map((k) => (
              <TouchableOpacity
                key={k}
                style={[styles.key, k === "=" ? styles.keyEqual : null]}
                onPress={() => press(k)}
              >
                <Text style={styles.keyText}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// --- Estilos ---
const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  menuBtn: { padding: 8, marginRight: 8 },
  title: { fontSize: 18, fontWeight: "bold" },
  display: { padding: 20, alignItems: "flex-end" },
  exprInput: {
    fontSize: 22,
    color: "#333",
    width: "100%",
    textAlign: "right",
    borderBottomWidth: 1,
    borderColor: "#ccc",
    paddingBottom: 4,
  },
  resultText: { fontSize: 30, fontWeight: "700", color: "#111", marginTop: 8 },
  keypad: { paddingHorizontal: 12, paddingBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  key: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: "#f2f2f2",
    height: 64,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  keyEqual: { backgroundColor: "#ffb74d" },
  keyText: { fontSize: 22, fontWeight: "600" },
  drawerContainer: {
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fafafa",
    paddingVertical: 10,
  },
  drawer: { paddingHorizontal: 16 },
  drawerTitle: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: "#1976d2",
    padding: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  varRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
});

import React from "react";
import { SafeAreaView } from "react-native";
import OrderForm from "./OrderForm";  // Import OrderForm

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <OrderForm />
    </SafeAreaView>
  );
}

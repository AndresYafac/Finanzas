package com.fintrack.pro;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FintrackBiometricPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

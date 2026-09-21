package io.github.simon123h.jotter;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StoragePermissionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

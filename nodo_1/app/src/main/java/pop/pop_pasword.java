package pop;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import com.example.nodo_1.R;
import com.example.nodo_1.admin;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;

public class pop_pasword {
    public void showPopupWindow(final View view, principal principal, admin admin) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pasword_admin, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        EditText editTextPass = (EditText) popupView.findViewById(R.id.editTextPass);
        Button   button       = (Button)   popupView.findViewById(R.id.butPass);


        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(editTextPass.length() > 0){
                    generales.saveData_sharedPreferences(popupView.getContext(), popupView.getContext().getString(R.string.passAdmin), "pasAdmin", editTextPass.getText().toString());
                    generales.toast("DATOS GUARDADOS", popupView.getContext());
                    if(admin!=null)admin.subirDatos("pasAdmin",editTextPass.getText().toString(),"pasAdmin");
                    if(principal!=null)principal.subirDatos("pasAdmin",editTextPass.getText().toString(),"pasAdmin");
                    popupWindow.dismiss();
                }
            }
        });
    }
}

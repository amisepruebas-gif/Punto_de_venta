package pop;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.animation.Animation;
import android.view.animation.AnimationUtils;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import androidx.constraintlayout.widget.ConstraintLayout;

import com.example.nodo_1.R;

public class ventaRealizada {

    PopupWindow popupWindow;
    ConstraintLayout cons_venta_realizada;
    Context context;
    public void showPopupWindow(View view) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.venta_realizada, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        popupWindow = new PopupWindow(popupView, width, height, focusable);
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        cons_venta_realizada = (ConstraintLayout)popupView.findViewById(R.id.cons_venta_realizada);
        cons_venta_realizada.setVisibility(View.VISIBLE);
        Animation animation = AnimationUtils.loadAnimation(popupView.getContext(), R.anim.fadeinrapido);
        cons_venta_realizada.startAnimation(animation);
        context = popupView.getContext();
    }
    public void fadeOut(){
        Animation animation = AnimationUtils.loadAnimation(context, R.anim.fadeoutrapido);
        cons_venta_realizada.startAnimation(animation);
    }
    public void off(){
        popupWindow.dismiss();
    }
}
